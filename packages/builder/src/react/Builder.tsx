"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNode } from "../core/registry.js";
import type { Project, ScreenNode } from "../core/schema.js";
import { countNodes, insertNode, newId } from "../core/tree.js";
import { toTypeName, validateProject } from "../core/validate.js";
import { blankTemplate } from "../definitions/templates.js";
import { BuilderContext, showsHelp, type BuilderContextValue } from "./context.js";
import type { BuilderEntry, BuilderEvent, BuilderHost, EventProps } from "./host.js";
import { UI } from "./icons.js";
import { summary, untilPaint } from "./perf.js";
import { createAutosave, loadDraft, prefs } from "./persist.js";
import { CodeView } from "./panels/CodeView.js";
import { ExportDialog } from "./panels/ExportDialog.js";
import { Layers } from "./panels/Layers.js";
import { Library } from "./panels/Library.js";
import { ProjectsDialog } from "./panels/Projects.js";
import { Properties } from "./panels/Properties.js";
import { DescribeDialog, ExplainPanel, OnboardingDialog, TemplatesDialog, WebBridgeCard, projectFromTemplate } from "./panels/Starts.js";
import { preloadFor } from "./preview/NodeView.js";
import { Phone } from "./preview/Phone.js";
import { createStore, useStore, type Panel, type Persona } from "./store.js";

type Dialog = "export" | "templates" | "describe" | "onboarding" | "projects" | null;
type MobileTab = "preview" | "add" | "layers" | "edit" | "code";

/** Picks the starting project: a linked template, else the saved draft, else a blank screen; then adds a linked component. */
function boot(host: BuilderHost, entry: BuilderEntry) {
  const notes: string[] = [];
  let project: Project | null = null;
  let from = "draft";
  const t = entry.template ? host.templates.get(entry.template) : undefined;
  if (t && (t.availability === "free" || host.limits.tier === "pro")) {
    project = projectFromTemplate(t, host).project;
    from = "template";
  } else if (t) {
    notes.push(`${t.name} is a Pro template.`);
  }
  if (!project) {
    const draft = loadDraft(host.storageKey);
    if (draft) {
      const r = validateProject(draft, host.registry, host.limits);
      project = r.value;
      if (r.issues.length) notes.push(r.issues[0]);
    }
  }
  if (!project) {
    project = validateProject(blankTemplate.create(() => newId()), host.registry, host.limits).value;
    from = "blank";
  }
  let selected: string | null = null;
  const def = entry.component ? host.registry.get(entry.component) : undefined;
  if (def && !def.hidden) {
    if (host.registry.usable(def, host.limits)) {
      const screen = project.screens[0];
      if (countNodes(screen.root) < host.limits.maxNodesPerScreen) {
        const node: ScreenNode = createNode(def);
        project = { ...project, screens: [{ ...screen, root: insertNode(screen.root, screen.root.id, node) }, ...project.screens.slice(1)] };
        selected = node.id;
        from = "component";
      }
    } else {
      notes.push(`${def.name} is part of SwiftPieces Pro.`);
    }
  }
  return { project, selected, notes, from };
}

export function Builder({ host, entry = {} }: { host: BuilderHost; entry?: BuilderEntry }) {
  const t0 = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const trackRef = useRef(host.track);
  trackRef.current = host.track;
  const track = useCallback((event: BuilderEvent, props?: EventProps) => {
    try {
      trackRef.current?.(event, props);
    } catch {}
  }, []);

  const autosave = useMemo(() => createAutosave(host.storageKey), [host.storageKey]);
  const [initialPersona] = useState<Persona | null>(() => prefs.persona(host.storageKey));
  const [persona, setPersonaState] = useState<Persona>(initialPersona ?? "explore");
  const [started] = useState(() => boot(host, entry));
  const [store] = useState(() =>
    createStore(
      {
        project: started.project,
        screenId: started.project.screens[0].id,
        selectedId: started.selected,
        notice: started.notes.length ? { text: started.notes[0], tone: "warn" } : null,
        panel: initialPersona === "swiftui" ? "split" : "preview",
        scheme: "dark",
      },
      { registry: host.registry, limits: host.limits, onChange: (p) => autosave.schedule(p), onEvent: (e, p) => track(e as BuilderEvent, p) },
    ),
  );
  const [dialog, setDialog] = useState<Dialog>(initialPersona || entry.component ? null : "onboarding");
  const [explaining, setExplaining] = useState<string[] | null>(null);
  const [mobile, setMobile] = useState<MobileTab>("preview");
  const [left, setLeft] = useState<"add" | "layers">("add");
  const [bridge, setBridge] = useState(() => !prefs.dismissed(host.storageKey, "web-bridge"));
  const [cloudId, setCloudId] = useState<string | null>(entry.projectId ?? null);
  const [saving, setSaving] = useState(false);

  const panel = useStore(store, (s) => s.panel);
  const scheme = useStore(store, (s) => s.scheme);
  const notice = useStore(store, (s) => s.notice);
  const projectName = useStore(store, (s) => s.project.name);
  const screens = useStore(store, (s) => s.project.screens);
  const screenId = useStore(store, (s) => s.screenId);
  const shell = useStore(store, (s) => s.project.shell);
  const multi = host.limits.maxScreens > 1;

  // Open once: the event, the first-paint measurement, the renderer chunks this project needs.
  useEffect(() => {
    started.project.screens.forEach((s) => preloadFor(s.root));
    // A start that differs from the saved draft (a linked template or component) is saved right
    // away, so reloading never loses it.
    if (started.from !== "draft") autosave.schedule(started.project);
    untilPaint("init", t0.current);
    track("builder_opened", { tier: host.limits.tier, persona: initialPersona ?? "unset", entry: started.from });
    if (entry.template) track("template_selected", { template: entry.template, via: "link" });
    if (entry.component) track("component_selected", { component: entry.component, via: "link" });
    // Budgets, once per session after the builder has been used a while.
    const perf = setTimeout(() => {
      const s = summary();
      const slow = Object.entries(s).filter(([, v]) => !v.ok).map(([k]) => k);
      track("builder_perf", { init: s.init?.last ?? -1, update: s.propertyUpdate?.max ?? -1, codegen: s.codegen?.max ?? -1, over: slow.join(",") || "none" });
    }, 60_000);
    return () => clearTimeout(perf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never lose work: write the draft when the tab hides or closes.
  useEffect(() => {
    const flush = () => autosave.flush();
    const onVis = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [autosave]);

  // Notices fade on their own.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => store.clearNotice(), notice.tone === "warn" ? 6000 : 2400);
    return () => clearTimeout(t);
  }, [notice, store]);

  // Keyboard shortcuts, except while typing or while a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Handled already (the Layers tree acts on its own keys), so never act twice.
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], dialog")) return;
      const mod = e.metaKey || e.ctrlKey;
      const sel = store.getState().selectedId;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
      } else if (mod && e.key.toLowerCase() === "d" && sel) {
        e.preventDefault();
        store.duplicate(sel);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel && !el.closest("[role=tree]")) {
        e.preventDefault();
        store.remove(sel);
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && sel && !el.closest("[role=tree]")) {
        e.preventDefault();
        store.move(sel, e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Escape" && sel) {
        store.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const setPersona = useCallback(
    (p: Persona) => {
      setPersonaState(p);
      prefs.setPersona(host.storageKey, p);
      track("onboarding_answered", { persona: p });
    },
    [host.storageKey, track],
  );

  const ctx: BuilderContextValue = useMemo(
    () => ({
      store,
      host,
      persona,
      setPersona,
      track,
      explain: (ids) => {
        const list = Array.isArray(ids) ? ids : [ids];
        setExplaining(list);
        track("explain_opened", { concept: list[0] });
      },
      open: setDialog,
    }),
    [store, host, persona, setPersona, track],
  );

  const pickPersona = (p: Persona) => {
    setPersona(p);
    setDialog(null);
    if (p === "swiftui") store.setPanel("split");
    const root = store.screen().root;
    if (!root.children?.length && p !== "swiftui") setTimeout(() => setDialog("templates"), 50);
  };

  const saveCloud = async () => {
    if (!host.cloud) return;
    setSaving(true);
    autosave.flush();
    try {
      const project = store.getState().project;
      const { id } = await host.cloud.save(cloudId ? { ...project, id: cloudId } : project);
      setCloudId(id);
      store.notify("Saved to your account.");
      if (typeof window !== "undefined" && window.location.pathname !== `/project/${id}`) window.history.replaceState(null, "", `/project/${id}`);
    } catch {
      store.notify("Couldn't save to your account. Your work is still saved on this device.", "warn");
    } finally {
      setSaving(false);
    }
  };

  const setView = (v: Panel) => store.setPanel(v);

  return (
    <BuilderContext.Provider value={ctx}>
      <div className="spb" data-mobile={mobile} data-panel={panel}>
        <header className="spb-bar">
          <div className="spb-bar-start">
            <label className="spb-name">
              <span className="spb-sr">Project name</span>
              <input
                className="spb-input spb-input-name"
                defaultValue={projectName}
                key={projectName}
                maxLength={32}
                onBlur={(e) => {
                  const name = toTypeName(e.target.value, "MyApp").slice(0, 32);
                  e.target.value = name;
                  if (name !== store.getState().project.name) store.renameProject(name);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                spellCheck={false}
              />
            </label>
            {multi ? (
              <div className="spb-screens" role="group" aria-label="Screens">
                <select className="spb-select spb-select-sm" value={screenId} onChange={(e) => store.setScreen(e.target.value)} aria-label="Current screen">
                  {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  className="spb-icon-btn"
                  aria-label="Add a screen"
                  title="Add a screen"
                  onClick={() => {
                    const n = store.getState().project.screens.length + 1;
                    const { value } = validateProject({ screens: [{ name: `Screen${n}View`, root: blankTemplate.create(() => newId()).screens[0].root }] }, host.registry, host.limits);
                    if (store.addScreen({ ...value.screens[0], id: newId("s"), name: `Screen${n}View` })) track("screen_created", { from: "blank" });
                  }}
                >
                  <UI name="plus" />
                </button>
                {screens.length > 1 ? (
                  <select className="spb-select spb-select-sm" value={shell} onChange={(e) => store.setShell(e.target.value as Project["shell"])} aria-label="How screens are presented">
                    <option value="single">First screen only</option>
                    <option value="tabs">Tab bar</option>
                  </select>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="spb-bar-notice" role="status" aria-live="polite">{notice ? <span className={`spb-notice is-${notice.tone}`}>{notice.text}</span> : null}</div>

          <div className="spb-bar-end">
            <button type="button" className="spb-icon-btn" onClick={() => store.undo()} aria-label="Undo" title="Undo (⌘Z)"><UI name="undo" /></button>
            <button type="button" className="spb-icon-btn" onClick={() => store.redo()} aria-label="Redo" title="Redo (⇧⌘Z)"><UI name="redo" /></button>
            <button type="button" className="spb-icon-btn" onClick={() => store.setScheme(scheme === "dark" ? "light" : "dark")} aria-label={`Preview in ${scheme === "dark" ? "light" : "dark"} appearance`} title="Preview appearance">
              <UI name={scheme === "dark" ? "moon" : "sun"} />
            </button>
            <div className="spb-seg spb-view" role="radiogroup" aria-label="View">
              {(["preview", "split", "code"] as Panel[]).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={panel === v} onClick={() => setView(v)}>{v === "preview" ? "Preview" : v === "split" ? "Both" : "SwiftUI"}</button>
              ))}
            </div>
            <button type="button" className="spb-btn spb-btn-ghost spb-bar-templates" onClick={() => setDialog("templates")}>Templates</button>
            <button type="button" className="spb-btn spb-btn-ghost" onClick={() => setDialog("describe")}><UI name="sparkle" size={14} /> Describe</button>
            {host.cloud ? (
              <>
                <button type="button" className="spb-btn spb-btn-ghost" onClick={() => setDialog("projects")}>Projects</button>
                <button type="button" className="spb-btn spb-btn-ghost" onClick={saveCloud} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </>
            ) : host.links.signIn ? (
              <a
                className="spb-btn spb-btn-ghost"
                href={host.links.signIn(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search)}
                onClick={() => (autosave.flush(), track("signup_started", { from: "save" }))}
              >
                Sign in to save
              </a>
            ) : null}
            <button type="button" className="spb-btn spb-btn-primary" onClick={() => setDialog("export")}>Export</button>
          </div>
        </header>

        {!initialPersona && entry.component && dialog === null && persona === "explore" && !prefs.dismissed(host.storageKey, "persona-strip") ? (
          <PersonaStrip onPick={(p) => pickPersona(p)} onDismiss={() => prefs.dismiss(host.storageKey, "persona-strip")} />
        ) : null}

        <div className="spb-main">
          <aside className="spb-left" aria-label="Components and layers">
            <div className="spb-seg spb-left-tabs" role="tablist" aria-label="Left panel">
              <button type="button" role="tab" aria-selected={left === "add"} onClick={() => setLeft("add")}>Components</button>
              <button type="button" role="tab" aria-selected={left === "layers"} onClick={() => setLeft("layers")}>Layers</button>
            </div>
            <div className="spb-left-body" data-show={left}>
              <div className="spb-pane-add"><Library onAdded={() => setMobile("preview")} /></div>
              <div className="spb-pane-layers"><Layers /></div>
            </div>
            {persona === "web" && bridge ? <WebBridgeCard onDismiss={() => (setBridge(false), prefs.dismiss(host.storageKey, "web-bridge"))} /> : null}
          </aside>

          <section className="spb-center" aria-label="Preview and code">
            {panel !== "code" ? (
              <div className="spb-center-preview" role="img" aria-label={`iPhone preview of ${store.screen().name}. Use Layers to select components with the keyboard.`}>
                <Phone />
              </div>
            ) : null}
            {panel !== "preview" ? <div className="spb-center-code"><CodeView /></div> : null}
            {explaining ? <ExplainPanel ids={explaining} onClose={() => setExplaining(null)} /> : null}
            {panel === "preview" && showsHelp(persona) ? (
              <button type="button" className="spb-peek" onClick={() => setView("split")}>
                <UI name="code" size={14} /> See the SwiftUI for this screen
              </button>
            ) : null}
          </section>

          <aside className="spb-right" aria-label="Properties">
            <Properties />
          </aside>
        </div>

        <nav className="spb-tabs" aria-label="Builder sections">
          {([["preview", "Screen", "phone"], ["add", "Add", "plus"], ["layers", "Layers", "layers"], ["edit", "Edit", "sliders"], ["code", "SwiftUI", "code"]] as const).map(([id, label, icon]) => (
            <button key={id} type="button" aria-pressed={mobile === id} onClick={() => setMobile(id)}>
              <UI name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <OnboardingDialog open={dialog === "onboarding"} onClose={() => setDialog(null)} onPick={pickPersona} />
        <TemplatesDialog open={dialog === "templates"} onClose={() => setDialog(null)} />
        <DescribeDialog open={dialog === "describe"} onClose={() => setDialog(null)} />
        <ExportDialog open={dialog === "export"} onClose={() => setDialog(null)} flush={() => autosave.flush()} />
        <ProjectsDialog open={dialog === "projects"} onClose={() => setDialog(null)} onOpened={(id) => setCloudId(id)} />
      </div>
    </BuilderContext.Provider>
  );
}

function PersonaStrip({ onPick, onDismiss }: { onPick: (p: Persona) => void; onDismiss: () => void }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const options: Array<[Persona, string]> = [["first-app", "My first iOS app"], ["web", "Coming from the web"], ["swiftui", "I know SwiftUI"]];
  return (
    <div className="spb-strip" role="region" aria-label="Personalise">
      <span className="spb-muted">New to SwiftUI? Pick one and the playground explains as much as you need.</span>
      {options.map(([id, label]) => <button key={id} type="button" className="spb-chip" onClick={() => (setGone(true), onPick(id))}>{label}</button>)}
      <button type="button" className="spb-icon-btn spb-icon-btn-sm" aria-label="Dismiss" onClick={() => (setGone(true), onDismiss())}>×</button>
    </div>
  );
}
