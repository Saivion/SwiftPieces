"use client";
import { useEffect, useState } from "react";
import { validateProject } from "../../core/validate.js";
import { useBuilder } from "../context.js";
import type { CloudProject } from "../host.js";
import { Dialog } from "./Dialog.js";

/** Saved projects in the account. Only offered when the host provides `cloud`. */
export function ProjectsDialog({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened: (id: string) => void }) {
  const { store, host, track } = useBuilder();
  const [items, setItems] = useState<CloudProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !host.cloud) return;
    let live = true;
    setError(null);
    host.cloud.list().then((l) => live && setItems(l)).catch(() => live && setError("Couldn't load your projects. Your current work is still saved on this device."));
    return () => {
      live = false;
    };
  }, [open, host.cloud]);

  if (!host.cloud) return null;
  const cloud = host.cloud;

  const openOne = async (id: string) => {
    setBusy(id);
    try {
      const raw = await cloud.load(id);
      const { value, issues } = validateProject(raw, host.registry, host.limits);
      store.replaceProject({ ...value, id });
      if (issues.length) store.notify(issues[0], "warn");
      onOpened(id);
      onClose();
    } catch {
      setError("Couldn't open that project. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this project from your account? This can't be undone.")) return;
    setBusy(id);
    try {
      await cloud.remove(id);
      setItems((l) => l?.filter((x) => x.id !== id) ?? null);
    } catch {
      setError("Couldn't delete that project.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Your projects" description="Projects saved to your account open on any device.">
      {error ? <p className="spb-callout is-warn" role="alert">{error}</p> : null}
      {items === null && !error ? <p className="spb-muted">Loading…</p> : null}
      {items?.length === 0 ? <p className="spb-muted">Nothing saved yet. Use Save to keep the project you&apos;re working on.</p> : null}
      <ul className="spb-projects">
        {items?.map((p) => (
          <li key={p.id}>
            <button type="button" className="spb-project" onClick={() => openOne(p.id)} disabled={busy !== null}>
              <span className="spb-tpl-name">{p.name}</span>
              <span className="spb-muted">{new Date(p.updatedAt).toLocaleString()}</span>
            </button>
            <button type="button" className="spb-btn spb-btn-sm spb-btn-ghost" onClick={() => remove(p.id)} disabled={busy !== null} aria-label={`Delete ${p.name}`}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="spb-dialog-foot">
        <span />
        <button
          type="button"
          className="spb-btn"
          onClick={() => {
            track("screen_created", { from: "new_project" });
            onClose();
          }}
        >
          Keep working
        </button>
      </div>
    </Dialog>
  );
}
