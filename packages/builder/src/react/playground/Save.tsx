"use client";
// Save, in the top bar beside the app's name: one place to keep a remix. Signed in, it saves to the
// account (the host's `cloudSave`, which the server checks: who, which plan, how many). Signed out,
// it opens a popup like Build's to sign in or create an account. A host with no accounts keeps the
// browser-only save it always had.
import { useEffect, useRef, useState } from "react";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { Ticks } from "./BuildDialog.js";
import { usePlay } from "./store.js";

/** Messages the host's save can throw that mean "sign in", not "show this". */
const SIGN_IN = /^(sign_in_required|bearer_required|HTTP 401)$/;

export function SaveButton() {
  const { store, host, track } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const entry = usePlay(store, (s) => s.entry);
  const status = usePlay(store, (s) => s.status);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  // A click while the account is still being checked: saved (or asked to sign in) once it answers.
  const [pending, setPending] = useState(false);
  const accounts = Boolean(host.cloudSave || host.links.signIn);
  const checking = accounts && host.session === null;
  const saved = savedAt !== null && project?.updatedAt === savedAt;
  const latest = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!pending) return;
    if (!checking) {
      setPending(false);
      void latest.current();
      return;
    }
    // The account never answered (offline, the Pro site down): say so rather than spin forever.
    const t = window.setTimeout(() => {
      setPending(false);
      store.notify("Couldn't reach your account. Try again in a moment.");
    }, 15_000);
    return () => window.clearTimeout(t);
  }, [pending, checking, store]);

  if (!entry || !project) return null;
  const save = async () => {
    if (busy || status !== "ready") return;
    // Still finding out who's here: never block the button on it, just finish the save when it answers.
    if (checking) {
      setPending(true);
      return;
    }
    // No accounts on this host: the browser-only save.
    if (!accounts) {
      store.saveRemix(entry.title);
      return;
    }
    if (!host.cloudSave) {
      setAsking(true);
      track("pro_gate_viewed", { from: "save" });
      return;
    }
    setBusy(true);
    const at = project.updatedAt;
    try {
      await host.cloudSave(project, entry.title);
      setSavedAt(at);
      store.notify("Saved to your account");
      track("remix_saved", { via: "cloud", kind: entry.kind, slug: entry.slug });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (SIGN_IN.test(message)) setAsking(true);
      else store.notify(message && !/^[a-z_]+$|^HTTP /.test(message) ? message : "That didn't save. Try again in a moment.");
      track("builder_error", { where: "save_cloud" });
    } finally {
      setBusy(false);
    }
  };
  latest.current = save;
  const working = busy || pending;
  return (
    <>
      <button
        type="button"
        className={`spp-btn spp-save-btn${saved ? " is-saved" : ""}`}
        onClick={() => void save()}
        disabled={working || status !== "ready"}
        aria-live="polite"
        title={saved ? "Saved to your account" : host.cloudSave ? "Save this remix to your account" : accounts ? "Save this remix" : "Save this remix in this browser"}
      >
        {working ? <span className="spb-spinner" /> : <UI name={saved ? "check" : "bookmark"} size={14} />}
        {saved ? "Saved" : "Save"}
      </button>
      {asking ? <SaveDialog onClose={() => setAsking(false)} /> : null}
    </>
  );
}

/** Signed out: sign in or create an account (on the site that holds accounts), then come back here. */
function SaveDialog({ onClose }: { onClose: () => void }) {
  const { host, track } = usePlayground();
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
  const here = typeof window === "undefined" ? "" : window.location.href;
  const limits = host.saveLimits;
  return (
    <dialog ref={dialog} className="spp-dialog spp-build-dialog spp-save-dialog" aria-labelledby="spp-save-title" onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="spp-build">
        <aside className="spp-build-art" aria-hidden>
          <div className="spp-build-canvas">{host.art ?? <div className="spp-build-fallback" />}</div>
        </aside>
        <div className="spp-build-main">
          <header className="spp-build-head">
            <div>
              <p className="spp-eyebrow">Save</p>
              <h2 id="spp-save-title">Keep your remixes</h2>
              <p className="spp-build-meta">
                Sign in, or create a free account, to save remixes and open them again on any device.
                {limits ? ` Free accounts keep ${limits.free}; Pro keeps ${limits.pro}.` : ""} You&apos;ll come straight back here.
              </p>
            </div>
            <button type="button" className="spp-icon-btn" onClick={onClose} aria-label="Close">
              <UI name="close" />
            </button>
          </header>
          <ul className="spp-build-grid spp-save-grid">
            {host.links.signUp ? (
              <li>
                <a className="spp-build-opt spp-build-primary" href={host.links.signUp(here)} onClick={() => track("pro_upgrade_clicked", { from: "save_sign_up" })}>
                  <Ticks />
                  <span className="spp-build-icon"><UI name="bookmark" size={15} /></span>
                  <span className="spp-build-text">
                    <span className="spp-build-title">Create account</span>
                    <span className="spp-build-desc">Free. Save this remix and every one after it, with its screens, Style and edits just as you left them.</span>
                  </span>
                </a>
              </li>
            ) : null}
            {host.links.signIn ? (
              <li>
                <a className="spp-build-opt" href={host.links.signIn(here)} onClick={() => track("pro_upgrade_clicked", { from: "save_sign_in" })}>
                  <Ticks />
                  <span className="spp-build-icon"><UI name="signIn" size={15} /></span>
                  <span className="spp-build-text">
                    <span className="spp-build-title">Sign in</span>
                    <span className="spp-build-desc">Already have an account? Sign in and this remix saves next to the ones you kept before.</span>
                  </span>
                </a>
              </li>
            ) : null}
          </ul>
          <p className="spp-build-meta">Your remix stays in this browser meanwhile, so nothing is lost while you sign in.</p>
        </div>
      </div>
    </dialog>
  );
}
