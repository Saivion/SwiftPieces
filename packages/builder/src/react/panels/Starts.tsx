"use client";
import { useState, type FormEvent } from "react";
import { concepts, webBridge } from "../../core/glossary.js";
import { applyTweaks, matchIntent } from "../../core/intent.js";
import type { Project, TemplateDefinition } from "../../core/schema.js";
import { newId } from "../../core/tree.js";
import { validateProject, validateScreenRoot } from "../../core/validate.js";
import { useBuilder } from "../context.js";
import type { Persona } from "../store.js";
import { preloadFor } from "../preview/NodeView.js";
import { Dialog } from "./Dialog.js";

/** Builds a validated project from a template, for the current plan. */
export function projectFromTemplate(t: TemplateDefinition, host: ReturnType<typeof useBuilder>["host"]): { project: Project; issues: string[] } {
  const raw = t.create(() => newId());
  const { value, issues } = validateProject(raw, host.registry, host.limits);
  return { project: value, issues };
}

// ---------------------------------------------------------------- Templates

export function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, host, track } = useBuilder();
  const multi = host.limits.maxScreens > 1;
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const groups = new Map<string, TemplateDefinition[]>();
  for (const t of host.templates.all) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);

  const pick = (t: TemplateDefinition) => {
    if (t.availability === "pro" && host.limits.tier !== "pro") {
      track("pro_cta_clicked", { from: "template", template: t.id });
      window.location.href = host.links.pro;
      return;
    }
    const { project } = projectFromTemplate(t, host);
    project.screens.forEach((s) => preloadFor(s.root));
    const current = store.getState().project;
    if (multi && mode === "add") {
      for (const s of project.screens) store.addScreen({ ...s, id: newId("s") });
    } else if (multi && project.screens.length === 1) {
      // Replace only the current screen; the rest of the project stays.
      const screenId = store.getState().screenId;
      store.replaceProject({ ...current, screens: current.screens.map((s) => (s.id === screenId ? { ...project.screens[0], id: screenId } : s)) });
      store.setScreen(screenId);
    } else {
      store.replaceProject({ ...project, id: current.id });
    }
    store.notify(`Started with ${t.name}. Undo brings back what you had.`);
    track("template_selected", { template: t.id });
    track("screen_created", { from: "template", template: t.id });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Start with a screen" description="Every template is built from SwiftPieces components, so you can change anything and export it." wide>
      {multi ? (
        <div className="spb-seg spb-seg-inline" role="radiogroup" aria-label="When picking a template">
          <button type="button" role="radio" aria-checked={mode === "replace"} onClick={() => setMode("replace")}>Replace this screen</button>
          <button type="button" role="radio" aria-checked={mode === "add"} onClick={() => setMode("add")}>Add as a new screen</button>
        </div>
      ) : null}
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="spb-tpl-group" aria-label={group}>
          <h3 className="spb-section-label">{group}</h3>
          <div className="spb-tpl-grid">
            {items.map((t) => (
              <button key={t.id} type="button" className="spb-tpl" onClick={() => pick(t)}>
                <span className="spb-tpl-name">{t.name}{t.availability === "pro" ? <span className="spb-badge">Pro</span> : null}</span>
                <span className="spb-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Describe

const EXAMPLES = ["A dark login screen with Apple sign in and forgot password", "Settings with notifications and privacy", "An empty state for invoices", "A welcome screen for a planning app"];

export function DescribeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, host, track } = useBuilder();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ai = Boolean(host.describe);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setBusy(true);
    setMessage(null);
    try {
      let root = null;
      let issues: string[] = [];
      let via = "local";
      if (host.describe) {
        try {
          const raw = await host.describe(text, { components: host.registry.listed().filter((d) => host.registry.usable(d, host.limits)).map((d) => d.id), templates: host.templates.all.map((t) => t.id) });
          root = validateScreenRoot(raw, host.registry, host.limits, issues);
          if (!root.children?.length) root = null;
          via = "ai";
        } catch {
          issues = [];
          root = null;
        }
      }
      if (!root) {
        const available = host.templates.all.filter((t) => t.availability === "free" || host.limits.tier === "pro");
        const match = matchIntent(text, available);
        const t = match && available.find((x) => x.id === match.templateId);
        if (t) {
          const { project } = projectFromTemplate(t, host);
          root = applyTweaks(project.screens[0].root, match!.tweaks);
          via = via === "ai" ? "ai_fallback" : "local";
        }
      }
      track("describe_used", { via, matched: root ? 1 : 0 });
      if (!root) {
        setMessage("I couldn't match that to a screen yet. Try naming the kind of screen: login, sign up, settings, profile, onboarding or an empty state.");
        return;
      }
      preloadFor(root);
      const current = store.getState().project;
      const screenId = store.getState().screenId;
      store.replaceProject({ ...current, screens: current.screens.map((s) => (s.id === screenId ? { ...s, root } : s)) });
      store.setScreen(screenId);
      store.notify(issues.length ? `Built from your description. ${issues[0]}` : "Built from your description. Undo brings back what you had.");
      track("screen_created", { from: via });
      onClose();
      setPrompt("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Describe a screen" description={ai ? "AI maps your words to SwiftPieces components. The result is a normal screen you can edit and export." : "Describe what you need and the closest starting screen is built for you, then tuned: dark or light, Apple sign in, a reset link."}>
      <form onSubmit={submit} className="spb-describe">
        <label htmlFor="spb-describe-input" className="spb-sr">Describe what you want to build</label>
        <textarea id="spb-describe-input" className="spb-input spb-textarea" rows={3} maxLength={500} placeholder="Describe what you want to build…" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => (e.key === "Enter" && (e.metaKey || e.ctrlKey) ? void submit() : undefined)} />
        <div className="spb-variants">
          {EXAMPLES.map((x) => <button key={x} type="button" className="spb-chip" onClick={() => setPrompt(x)}>{x}</button>)}
        </div>
        {message ? <p className="spb-callout is-warn" role="status">{message}</p> : null}
        <div className="spb-dialog-foot">
          {!ai && host.limits.tier === "free" ? <a className="spb-link" href={host.links.pro} onClick={() => track("pro_cta_clicked", { from: "describe" })}>Pro composes any screen with AI →</a> : <span />}
          <button type="submit" className="spb-btn spb-btn-primary" disabled={busy || !prompt.trim()}>{busy ? "Building…" : "Build it"}</button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Onboarding

const PERSONAS: Array<{ id: Persona; title: string; detail: string }> = [
  { id: "first-app", title: "My first iOS app", detail: "Show me what everything means as I go." },
  { id: "web", title: "I'm coming from the web", detail: "Explain SwiftUI in terms of React and CSS." },
  { id: "swiftui", title: "I already know SwiftUI", detail: "Skip the explanations. Code first." },
  { id: "explore", title: "Just exploring", detail: "Let me play with components." },
];

export function OnboardingDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: Persona) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="What are you building?" description="This only changes how much the playground explains. You can change it any time.">
      <div className="spb-personas" role="group" aria-label="What are you building?">
        {PERSONAS.map((p, i) => (
          <button key={p.id} type="button" className="spb-persona" onClick={() => onPick(p.id)} autoFocus={i === 0}>
            <span className="spb-persona-title">{p.title}</span>
            <span className="spb-muted">{p.detail}</span>
          </button>
        ))}
      </div>
      <div className="spb-dialog-foot"><span /><button type="button" className="spb-btn spb-btn-ghost" onClick={onClose}>Skip</button></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Explain

/** The glossary panel: plain words, then the closest web equivalent. */
export function ExplainPanel({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { persona } = useBuilder();
  const items = ids.map((id) => concepts[id]).filter(Boolean);
  if (!items.length) return null;
  return (
    <aside className="spb-explain" aria-label="What's this?" aria-live="polite">
      <div className="spb-explain-head">
        <span className="spb-section-label">What&apos;s this?</span>
        <button type="button" className="spb-icon-btn spb-icon-btn-sm" onClick={onClose} aria-label="Close explanations">×</button>
      </div>
      {items.map((c) => (
        <div key={c.id} className="spb-explain-item">
          <code className="spb-explain-term">{c.term}</code>
          <p>{c.plain}</p>
          {c.web && (persona === "web" || persona === "first-app" || persona === "explore") ? (
            <div className="spb-explain-web">
              <span className="spb-muted">{c.webLabel ?? "Web"} equivalent</span>
              <pre>{c.web}</pre>
            </div>
          ) : null}
        </div>
      ))}
    </aside>
  );
}

/** The "Coming from the web?" card: a lookup table, dismissible, shown to web developers. */
export function WebBridgeCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="spb-bridge" aria-label="Coming from the web?">
      <div className="spb-explain-head">
        <strong>Coming from the web?</strong>
        <button type="button" className="spb-icon-btn spb-icon-btn-sm" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
      <p className="spb-muted">SwiftUI maps closely onto what you know.</p>
      <table>
        <tbody>
          {webBridge.map((r) => (
            <tr key={r.web}>
              <td><code>{r.web}</code></td>
              <td aria-hidden>→</td>
              <td><code>{r.swift}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
