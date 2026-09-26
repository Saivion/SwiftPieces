"use client";
import { useState } from "react";
import { generateScreen } from "../../core/generate.js";
import { showsHelp, useBuilder } from "../context.js";
import { UI } from "../icons.js";
import { record } from "../perf.js";
import { Dialog } from "./Dialog.js";

type Kind = "copy" | "swift" | "project" | "files";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copy, download a file, or download a complete Xcode project. Everything is built in the browser. */
export function ExportDialog({ open, onClose, flush }: { open: boolean; onClose: () => void; flush: () => void }) {
  const { store, host, persona, track } = useBuilder();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [done, setDone] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const project = store.getState().project;
  const screen = store.screen();

  let code = "";
  let pieces: string[] = [];
  try {
    const gen = generateScreen(screen, host.registry);
    code = gen.code;
    pieces = gen.pieces.map((p) => p.name);
  } catch {
    code = "";
  }

  const run = async (kind: Kind) => {
    flush();
    setBusy(kind);
    setError(null);
    setDone(null);
    track("export_clicked", { kind, screens: project.screens.length });
    const t0 = performance.now();
    try {
      if (kind === "copy") {
        if (!code) throw new Error("generate");
        await navigator.clipboard.writeText(code);
        track("code_copied", { from: "export" });
      } else if (kind === "swift") {
        if (!code) throw new Error("generate");
        download(`${screen.name}.swift`, code, "text/x-swift");
        track("project_downloaded", { kind: "swift" });
      } else {
        // The zip writer and Xcode template load only now, on the first export.
        const mod = await import("../../export/index.js");
        const result = kind === "project" ? await mod.exportXcodeProject(project, host.registry, host.resolveSource) : await mod.exportSwiftFiles(project, host.registry, host.resolveSource);
        download(`${project.name}.zip`, result.archive.slice().buffer as ArrayBuffer, "application/zip");
        setMissing(result.missing.map((m) => m.name));
        record("export", performance.now() - t0);
        track("project_downloaded", { kind, pieces: pieces.length });
      }
      setDone(kind);
    } catch (e) {
      track("builder_error", { where: `export_${kind}` });
      setError(kind === "copy" && (e as Error).message !== "generate" ? "Couldn't reach the clipboard. Download the file instead." : "We couldn't generate the export yet. Your project is still saved locally.");
    } finally {
      setBusy(null);
    }
  };

  const cli = pieces.length ? `npx swiftpieces add ${[...new Set(pieces)].join(" ")}` : "";
  const beginner = showsHelp(persona) || persona === "explore";

  return (
    <Dialog open={open} onClose={onClose} title="Take it to Xcode" description={project.screens.length > 1 ? `${project.screens.length} screens · ${project.name}` : `${screen.name} · ${project.name}`}>
      <div className="spb-export">
        <button type="button" className="spb-export-opt is-primary" onClick={() => run("project")} disabled={busy !== null}>
          <span className="spb-export-title"><UI name="download" /> Download Xcode project</span>
          <span className="spb-muted">A complete app with your {project.screens.length > 1 ? "screens" : "screen"} and every component&apos;s source. Open it and press Run.</span>
          {busy === "project" ? <span className="spb-spinner" /> : null}
        </button>
        <button type="button" className="spb-export-opt" onClick={() => run("copy")} disabled={busy !== null}>
          <span className="spb-export-title"><UI name="copy" /> {done === "copy" ? "Copied" : "Copy SwiftUI"}</span>
          <span className="spb-muted">{screen.name}, ready to paste into a SwiftUI file.</span>
        </button>
        <button type="button" className="spb-export-opt" onClick={() => run("swift")} disabled={busy !== null}>
          <span className="spb-export-title"><UI name="code" /> Download {screen.name}.swift</span>
          <span className="spb-muted">Just this screen&apos;s file.</span>
        </button>
        <button type="button" className="spb-export-opt" onClick={() => run("files")} disabled={busy !== null}>
          <span className="spb-export-title"><UI name="layers" /> Swift files only (.zip)</span>
          <span className="spb-muted">Screens and component sources, to drop into an existing project.</span>
          {busy === "files" ? <span className="spb-spinner" /> : null}
        </button>
      </div>

      {error ? (
        <div className="spb-callout is-warn" role="alert">
          <p>{error}</p>
          <button type="button" className="spb-btn spb-btn-sm" onClick={() => setError(null)}>Try again</button>
        </div>
      ) : null}

      {done === "project" ? (
        <div className="spb-callout" role="status">
          <strong>Your project is downloading. What happens next:</strong>
          <ol className="spb-steps">
            <li>Unzip <code>{project.name}.zip</code>.</li>
            <li>Double-click <code>{project.name}.xcodeproj</code> to open it in Xcode 16 or later (free on the Mac App Store).</li>
            <li>Pick an iPhone simulator at the top and press <kbd>⌘R</kbd>. Your screen runs as a real app.</li>
          </ol>
          {beginner ? <p className="spb-muted">Open any <code>…View.swift</code> file and press <kbd>⌥⌘↩</kbd> to see the live preview next to the code. Edit a string, and the preview updates as you type.</p> : null}
          {missing.length ? <p className="spb-muted">Some component sources couldn&apos;t be downloaded. The README explains how to add them: <code>npx swiftpieces add {missing.join(" ")}</code></p> : null}
        </div>
      ) : null}

      {cli && !beginner ? (
        <div className="spb-cli">
          <span className="spb-muted">Already have a project? Add the components with the CLI, then paste the screen:</span>
          <code>{cli}</code>
        </div>
      ) : null}
      {beginner && done !== "project" ? (
        <p className="spb-muted spb-export-foot">Never used Xcode? Download the project: it opens as a working app, no setup. <a className="spb-link" href={host.links.install} target="_blank" rel="noreferrer">How installing works ↗</a></p>
      ) : null}
    </Dialog>
  );
}
