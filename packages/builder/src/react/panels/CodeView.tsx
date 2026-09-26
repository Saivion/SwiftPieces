"use client";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { generateScreen, GenerationError } from "../../core/generate.js";
import { conceptsInLine } from "../../core/glossary.js";
import { showsHelp, useBuilder } from "../context.js";
import { UI } from "../icons.js";
import { timed } from "../perf.js";
import { useStore } from "../store.js";

const KEYWORDS = new Set(["import", "struct", "var", "let", "some", "private", "true", "false", "in", "return", "if", "else", "await", "try", "func", "static"]);

/** A tiny line tokenizer: strings, comments, keywords, types, modifiers, numbers. No parser. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")|(\/\/.*$)|(@\w+|#\w+)|(\.[a-z]\w*)|\b([A-Z]\w*)\b|\b(\d+(?:\.\d+)?)\b|\b([a-z]\w*)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [t] = m;
    const cls = m[1] ? "str" : m[2] ? "com" : m[3] ? "attr" : m[4] ? "mod" : m[5] ? "type" : m[6] ? "num" : m[7] && KEYWORDS.has(m[7]) ? "kw" : null;
    out.push(cls ? <span key={k++} className={`spb-tok-${cls}`}>{t}</span> : t);
    last = m.index + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export const CodeView = memo(function CodeView() {
  const { store, host, persona, track, explain } = useBuilder();
  const screen = useStore(store, (s) => s.project.screens.find((x) => x.id === s.screenId) ?? s.project.screens[0]);
  const selectedId = useStore(store, (s) => s.selectedId);
  // Typing in a property stays instant: the code catches up in a deferred render.
  const deferred = useDeferredValue(screen);
  const result = useMemo(() => {
    try {
      return { gen: timed("codegen", () => generateScreen(deferred, host.registry)), error: null };
    } catch (e) {
      track("builder_error", { where: "codegen" });
      return { gen: null, error: e instanceof GenerationError ? e.message : "Unexpected error" };
    }
  }, [deferred, host.registry, track]);
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const help = showsHelp(persona);

  const lines = useMemo(() => result.gen?.code.split("\n") ?? [], [result.gen]);
  const range = selectedId ? result.gen?.ranges[selectedId] : undefined;

  useEffect(() => {
    if (!range || !box.current) return;
    box.current.querySelector(`[data-line="${range[0]}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [range?.[0], range]);

  /** The innermost node whose code contains this line. */
  const nodeAt = (line: number): string | null => {
    let best: [string, number] | null = null;
    for (const [id, [a, b]] of Object.entries(result.gen?.ranges ?? {})) {
      if (line >= a && line <= b && (!best || b - a < best[1])) best = [id, b - a];
    }
    return best?.[0] ?? null;
  };

  const copy = async () => {
    if (!result.gen) return;
    try {
      await navigator.clipboard.writeText(result.gen.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      track("code_copied", { from: "code_view" });
    } catch {
      store.notify("Couldn't reach the clipboard. Select the code and copy it instead.", "warn");
    }
  };

  if (result.error) {
    return (
      <div className="spb-code spb-code-error" role="alert">
        <strong>We couldn&apos;t generate the code yet.</strong>
        <p>Your project is still saved locally. {result.error}</p>
        <button type="button" className="spb-btn" onClick={() => setRetry(retry + 1)}>Try again</button>
      </div>
    );
  }

  return (
    <div className="spb-code">
      <div className="spb-code-head">
        <span className="spb-code-file">{result.gen?.fileName}</span>
        {help ? <span className="spb-muted spb-code-tip">Click any line to see what it does.</span> : null}
        {help ? (
          <button
            type="button"
            className="spb-btn spb-btn-sm spb-btn-ghost"
            onClick={() => {
              const span = range ? lines.slice(range[0] - 1, range[1]) : lines;
              const ids = [...new Set(span.flatMap((l) => conceptsInLine(l).map((c) => c.id)))];
              if (ids.length) explain(ids.slice(0, 6));
            }}
          >
            <UI name="question" size={14} />
            What&apos;s this?
          </button>
        ) : null}
        <button type="button" className="spb-btn spb-btn-sm" onClick={copy} aria-live="polite">
          <UI name="copy" size={14} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="spb-code-body" ref={box} tabIndex={0} aria-label="Generated SwiftUI">
        <ol>
          {lines.map((line, i) => {
            const n = i + 1;
            const inRange = range && n >= range[0] && n <= range[1];
            return (
              <li
                key={i}
                data-line={n}
                className={inRange ? "is-hl" : undefined}
                onClick={() => {
                  const id = nodeAt(n);
                  if (id) store.select(id === screen.root.id ? null : id);
                  if (help) {
                    const found = conceptsInLine(line);
                    if (found.length) explain(found.map((c) => c.id));
                  }
                }}
              >
                <span className="spb-ln" aria-hidden>{n}</span>
                <code>{highlight(line)}{line ? null : " "}</code>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
});
