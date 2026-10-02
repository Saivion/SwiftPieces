"use client";
// The SwiftUI tab: the file for the screen on the device, with the selected component's lines lit,
// plus the app's other files. Generated from the same tree the device runs, on every remix, in the
// browser. Highlighting is a tiny tokenizer: no dependency, no worker, a few hundred lines at most.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { generateProject } from "../../core/generate.js";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { CopyButton } from "./Controls.js";
import { useGenerated } from "./Inspector.js";
import { currentScreenId, usePlay } from "./store.js";

export const CodePanel = memo(function CodePanel({ onBuild }: { onBuild: () => void }) {
  const { store, host, track } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => s.selected?.screenId ?? currentScreenId(s.nav));
  const selected = usePlay(store, (s) => s.selected?.nodeId ?? null);
  const screen = project?.screens.find((s) => s.id === current) ?? project?.screens[0] ?? null;
  const generated = useGenerated(project, screen);
  const [file, setFile] = useState<string | null>(null);
  const files = useMemo(() => {
    if (!project) return [];
    try {
      return generateProject(project, host.registry).files;
    } catch {
      return [];
    }
  }, [project, host.registry]);
  // Follow the device: a new screen resets the tab to that screen's file.
  useEffect(() => setFile(null), [screen?.id]);
  const shown = file ? files.find((f) => f.path === file) : null;
  const code = shown ? shown.content : generated?.code ?? "";
  const range = !shown && selected && generated ? generated.ranges[selected] : undefined;
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!range) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-line="${range[0]}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [range?.[0], range?.[1]]);

  if (!project || !screen) return null;
  const name = shown?.path ?? generated?.fileName ?? "";
  const download = () => {
    const blob = new Blob([code], { type: "text/x-swift" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    track("project_downloaded", { scope: "file" });
  };
  return (
    <div className="spp-code">
      <div className="spp-code-bar">
        <select className="spp-select spp-select-sm" value={shown?.path ?? ""} onChange={(e) => setFile(e.target.value || null)} aria-label="File">
          <option value="">{generated?.fileName}</option>
          {files.filter((f) => f.path !== generated?.fileName).map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
        </select>
        <div className="spp-code-actions">
          <CopyButton text={code} onCopied={() => track("code_copied", { scope: shown ? "file" : "screen" })} />
          <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={download} aria-label={`Download ${name}`} title="Download">
            <UI name="download" size={14} />
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="spp-code-body">
        <pre className="spp-pre">
          <code>
            {code.split("\n").map((line, i) => {
              const n = i + 1;
              const lit = range && n >= range[0] && n <= range[1];
              return (
                <span key={i} className={`spp-line${lit ? " is-lit" : ""}`} data-line={n}>
                  <span className="spp-ln" aria-hidden>{n}</span>
                  <span className="spp-lc">{highlight(line)}</span>
                  {"\n"}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
      <div className="spp-code-foot">
        <p className="spp-hint">
          {generated?.pieces.length ? <>Uses {generated.pieces.map((p) => p.name).join(", ")}. </> : "Plain SwiftUI. "}
          Take the whole app with <button type="button" className="spp-link" onClick={onBuild}>Build</button>.
        </p>
      </div>
    </div>
  );
});

const KEYWORDS = new Set(["import", "struct", "var", "let", "some", "private", "func", "return", "if", "else", "for", "in", "switch", "case", "default", "true", "false", "nil", "self", "Self", "static", "enum", "extension", "init", "guard", "while", "@main", "@State", "@Environment", "@Binding", "@FocusState"]);
const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@?[A-Za-z_][A-Za-z0-9_]*)|(\.[a-z][A-Za-z0-9_]*)|(\b\d+(?:\.\d+)?\b)|([^A-Za-z0-9_"@./]+|.)/g;

/** Swift, lightly: comments, strings, keywords, types, members and numbers. */
function highlight(line: string): ReactNode {
  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    const [text, comment, string, word, member, number] = m;
    const k = i++;
    if (comment) out.push(<span key={k} className="tk-c">{text}</span>);
    else if (string) out.push(<span key={k} className="tk-s">{text}</span>);
    else if (word) out.push(KEYWORDS.has(word) ? <span key={k} className="tk-k">{text}</span> : /^[A-Z]/.test(word) ? <span key={k} className="tk-t">{text}</span> : text);
    else if (member) out.push(<span key={k} className="tk-m">{text}</span>);
    else if (number) out.push(<span key={k} className="tk-n">{text}</span>);
    else out.push(text);
  }
  return out;
}
