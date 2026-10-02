"use client";
// Build: the step out of the Playground. The remix as a real app: opened straight in Xcode (the
// project travels inside a Git URL, nothing stored), downloaded as an Xcode project, as this
// screen's SwiftUI, as a prompt for your coding agent, or as a link that opens this exact remix.
// A colour side shows the host's artwork with what the app holds. Loaded only when opened.
import { useEffect, useMemo, useRef, useState } from "react";
import { generateProject } from "../../core/generate.js";
import { agentPrompt } from "../../core/prompt.js";
import { encodeProject, MAX_SHARE_LENGTH } from "../../core/share.js";
import { catalogPath } from "../../core/catalog.js";
import { ProCrown, UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { useGenerated } from "./Inspector.js";
import { currentScreenId, usePlay } from "./store.js";

const isMac = () => typeof navigator !== "undefined" && /Mac/.test(navigator.platform || navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent);

function saveFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Action = "xcode" | "zip" | "swift" | "prompt" | "share" | "handoff" | "cloud";

export function BuildDialog({ onClose }: { onClose: () => void }) {
  const { store, host, track } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const entry = usePlay(store, (s) => s.entry);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const screen = project?.screens.find((s) => s.id === current) ?? project?.screens[0] ?? null;
  const generated = useGenerated(project, screen);
  const [blob, setBlob] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [done, setDone] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener("cancel", onCancel);
    return () => d?.removeEventListener("cancel", onCancel);
  }, [onClose]);

  // The project as one URL-safe string: Xcode's Git URL, the share link and the Pro handoff.
  useEffect(() => {
    if (!project) return;
    let live = true;
    encodeProject(project, host.registry).then((b) => live && setBlob(b)).catch(() => live && setBlob(null));
    return () => {
      live = false;
    };
  }, [project, host.registry]);

  const pieces = useMemo(() => {
    if (!project) return [] as string[];
    try {
      return [...new Set(generateProject(project, host.registry).pieces.map((p) => p.name))];
    } catch {
      return [];
    }
  }, [project, host.registry]);

  if (!project || !screen || !entry) return null;
  const tooBig = blob !== null && blob.length > MAX_SHARE_LENGTH;
  const repo = blob && !tooBig && host.links.xcodeRepo ? host.links.xcodeRepo(blob, project.name) : null;
  const shareUrl = blob && !tooBig ? `${window.location.origin}${host.links.entryPath?.(entry) ?? catalogPath(entry, host.basePath)}#r=${blob}` : null;
  const mac = isMac();

  const run = async (a: Action, fn: () => Promise<void> | void) => {
    setBusy(a);
    setError(null);
    setDone(null);
    try {
      await fn();
      setDone(a);
    } catch {
      track("builder_error", { where: `build_${a}` });
      setError(a === "zip" ? "The project couldn't be packaged. Try again, or copy the SwiftUI." : "That didn't work. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };
  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <dialog ref={dialog} className="spp-dialog spp-build-dialog" aria-labelledby="spp-build-title" onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="spp-build">
        {/* The colour side: the site's own artwork, bright and full bleed, like the landing's close. */}
        <aside className="spp-build-art" aria-hidden>
          <div className="spp-build-canvas">{host.art ?? <div className="spp-build-fallback" />}</div>
        </aside>

        <div className="spp-build-main">
          <header className="spp-build-head">
            <div>
              <p className="spp-eyebrow">Build</p>
              <h2 id="spp-build-title">Take {entry.title} into your app</h2>
              <p className="spp-build-meta">
                {project.screens.length} screen{project.screens.length === 1 ? "" : "s"} of SwiftUI{pieces.length ? ` and ${pieces.length} Swift Piece${pieces.length === 1 ? "" : "s"}` : ""}, yours to ship. Built in your browser, nothing stored on our servers.
              </p>
            </div>
            <button type="button" className="spp-icon-btn" onClick={onClose} aria-label="Close">
              <UI name="close" />
            </button>
          </header>


          <ul className="spp-build-grid">
            {/* The one step that matters most: straight into Xcode, the one card in the accent. */}
            {host.links.xcodeRepo ? (
              <Option
                icon="hammer"
                primary
                title="Run it on your Mac"
                desc={
                  !mac
                    ? "Xcode needs a Mac. Download the project instead."
                    : tooBig
                      ? "Too large for the browser. Download it instead."
                      : done === "xcode"
                        ? "Nothing happened? Opening needs Xcode 16 or later."
                        : "Opens in Xcode. Pick a folder, press ⌘R."
                }
                disabled={!repo || !mac}
                busy={false}
                done={false}
                onClick={() => {
                  if (!repo) return;
                  track("xcode_opened", { screens: project.screens.length, kind: entry.kind, slug: entry.slug });
                  window.location.href = `xcode://clone?repo=${encodeURIComponent(repo)}`;
                  setDone("xcode");
                }}
              />
            ) : null}
            <Option
              icon="download"
              title="Download the project"
              desc="A ready-to-run Xcode project as one zip file."
              busy={busy === "zip"}
              done={done === "zip"}
              doneLabel="Downloaded"
              onClick={() =>
                run("zip", async () => {
                  const mod = await import("../../export/index.js");
                  const result = await mod.exportXcodeProject(project, host.registry, host.resolveSource);
                  saveFile(`${project.name}.zip`, result.archive.slice().buffer as ArrayBuffer, "application/zip");
                  setMissing(result.missing.map((m) => m.name));
                  track("project_downloaded", { scope: "project", screens: project.screens.length });
                })
              }
            />
            <Option
              icon="copy"
              title="Copy this screen"
              desc={`${screen.name}.swift, ready to paste straight into your app.`}
              busy={busy === "swift"}
              done={done === "swift"}
              doneLabel="SwiftUI copied"
              onClick={() =>
                run("swift", async () => {
                  await copy(generated?.code ?? "");
                  track("code_copied", { scope: "screen", kind: entry.kind, slug: entry.slug });
                })
              }
            />
            <Option
              icon="prompt"
              title="Copy an agent prompt"
              desc="Your coding agent continues in this exact style."
              busy={false}
              done={done === "prompt"}
              doneLabel="Prompt copied"
              onClick={() => run("prompt", async () => { await copy(agentPrompt(project, generateProject(project, host.registry), repo ? { repoUrl: repo } : {})); track("code_copied", { scope: "prompt" }); })}
            />
            <Option
              icon="link"
              title="Copy a share link"
              desc={tooBig ? "This remix is too large to fit a link." : "Anyone with the link opens this exact remix."}
              disabled={!shareUrl}
              busy={busy === "share"}
              done={done === "share"}
              doneLabel="Link copied"
              onClick={() => run("share", async () => { await copy(shareUrl!); track("remix_shared", { kind: entry.kind, slug: entry.slug }); })}
            />
            {host.cloudSave ? (
              <Option
                icon="bookmark"
                title="Save to your account"
                desc="Keep this remix in your account and open it anywhere."
                busy={busy === "cloud"}
                done={done === "cloud"}
                doneLabel="Saved"
                onClick={() => run("cloud", async () => { await host.cloudSave!(project, entry.title); track("remix_saved", { via: "cloud", kind: entry.kind, slug: entry.slug }); })}
              />
            ) : null}
            {host.links.handoff ? (
              <li>
                <a className={host.links.handoff.backdrop ? "spp-build-opt spp-build-pro" : "spp-build-opt"} href={host.links.handoff.url(blob && !tooBig ? blob : null)} onClick={() => track("pro_upgrade_clicked", { from: "handoff" })}>
                  {host.links.handoff.backdrop ? <span className="spp-build-backdrop" aria-hidden>{host.links.handoff.backdrop}</span> : null}
                  <Ticks />
                  {host.links.handoff.icon === "crown" ? (
                    <span className="spp-build-icon spp-pro-mark"><ProCrown size={15} /></span>
                  ) : (
                    <span className="spp-build-icon"><UI name={host.links.handoff.icon ?? "external"} size={15} /></span>
                  )}
                  <span className="spp-build-text">
                    <span className="spp-build-title">{host.links.handoff.label}</span>
                    <span className="spp-build-desc">{host.links.handoff.desc}</span>
                  </span>
                </a>
              </li>
            ) : null}
          </ul>

          {missing.length ? <p className="spp-hint">Couldn&apos;t fetch {missing.join(", ")}. Try the download again in a moment.</p> : null}
          {error ? <p className="spp-callout" role="alert">{error}</p> : null}
        </div>
      </div>
    </dialog>
  );
}

/** One card. Every card has the same shape (icon, title, one short line) so the grid stays even. */
function Option({ icon, title, desc, onClick, busy, done, doneLabel, disabled, primary }: { icon: "hammer" | "download" | "copy" | "prompt" | "link" | "bookmark"; title: string; desc: string; onClick: () => void; busy: boolean; done: boolean; doneLabel?: string; disabled?: boolean; primary?: boolean }) {
  return (
    <li>
      <button type="button" className={primary ? "spp-build-opt spp-build-primary" : "spp-build-opt"} onClick={onClick} disabled={busy || disabled}>
        <Ticks />
        <span className="spp-build-icon">{busy ? <span className="spb-spinner" /> : <UI name={done ? "check" : icon} size={15} />}</span>
        <span className="spp-build-text">
          <span className="spp-build-title">{done && doneLabel ? doneLabel : title}</span>
          <span className="spp-build-desc">{desc}</span>
        </span>
      </button>
    </li>
  );
}

/** The + crosses on a dashed card's corners, as the landing's frames draw them. */
export function Ticks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <svg key={c} aria-hidden viewBox="0 0 9 9" className={`spp-tick spp-tick-${c}`}>
          <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}
    </>
  );
}
