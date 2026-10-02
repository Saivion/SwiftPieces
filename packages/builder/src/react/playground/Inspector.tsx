"use client";
// The right panel. With nothing picked it explains the screen: what it is, what to try, what it is
// made of, and its look to remix. Pick a component (in Inspect mode, in the Map, or from the list)
// and it shows how that component is put together, the properties that matter for it, its states,
// how it behaves, and the SwiftUI it becomes, all from the one definition the preview runs.
import { lazy, memo, Suspense, useMemo, useState, type ReactNode } from "react";
import { CATALOG_KINDS } from "../../core/catalog.js";
import { generateScreen, type GeneratedScreen } from "../../core/generate.js";
import { anatomyOf, componentsIn, firstNodeOf, GROUP_LABELS, GROUP_ORDER, nodeSnippet, nodeSummary, propertyGroup, propertyVisible } from "../../core/inspect.js";
import { interactionById } from "../../core/interactions.js";
import { looks, lookById, themeFromLook } from "../../core/looks.js";
import { defaultProps } from "../../core/registry.js";
import type { Project, PropertyDefinition, PropertyGroup, Screen, ScreenNode, SwiftPieceDefinition, Theme } from "../../core/schema.js";
import { findNode, pathTo } from "../../core/tree.js";
import { validateScreenRoot } from "../../core/validate.js";
import { KindIcon, UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { CopyButton, Field } from "./Controls.js";
import { MAX_TABS, currentScreenId, usePlay, type PanelView, type RightTab } from "./store.js";
import { screenTitle } from "./Device.js";

const CodePanel = lazy(() => import("./CodePanel.js").then((m) => ({ default: m.CodePanel })));
const BuildMap = lazy(() => import("./BuildMap.js").then((m) => ({ default: m.BuildMap })));

/** Generated SwiftUI for one screen, memoized on the screen object (every edit makes a new one). */
const cache = new WeakMap<Screen, { key: Project["theme"]; screens: Screen[]; out: GeneratedScreen }>();
export function useGenerated(project: Project | null, screen: Screen | null): GeneratedScreen | null {
  const { host } = usePlayground();
  return useMemo(() => {
    if (!project || !screen) return null;
    const hit = cache.get(screen);
    if (hit && hit.key === project.theme && hit.screens === project.screens) return hit.out;
    try {
      const out = generateScreen(screen, host.registry, project.screens, project.theme);
      cache.set(screen, { key: project.theme, screens: project.screens, out });
      return out;
    } catch {
      return null;
    }
  }, [project, screen, host.registry]);
}

/**
 * A view the docked panel shows beside the inspector's own tabs (Screens or the host's sidebar,
 * Style). `hidden` folds its tab away (it stays in the bar, narrowed to nothing, so it can open back
 * out smoothly) and the panel never shows it.
 */
export type PanelTab = { id: Exclude<PanelView, "tools">; label: string; title?: string; render: () => ReactNode; hidden?: boolean };

/**
 * The inspector: Inspect, SwiftUI and Map. In the docked layout it is the whole left panel, with
 * `panels` (the host's sidebar, the screen library, the style) as tabs before its own, so there is
 * no right column.
 */
export const Inspector = memo(function Inspector({ onBuild, panels = [], tools }: { onBuild: () => void; panels?: PanelTab[]; tools?: Array<{ id: RightTab; label: string }> }) {
  const { store } = usePlayground();
  const tab = usePlay(store, (s) => s.tab);
  const panel = usePlay(store, (s) => s.panel);
  const status = usePlay(store, (s) => s.status);
  const tabs: Array<{ id: RightTab; label: string }> = tools ?? [
    { id: "inspect", label: "Inspect" },
    { id: "code", label: "SwiftUI" },
    { id: "map", label: "Map" },
  ];
  // With `tools` (docked), the one Map tab holds everything: the map, and whatever you pick in it.
  const nested = Boolean(tools) && !tabs.some((t) => t.id === "code");
  const lit: RightTab = nested ? "map" : tab;
  const picked = usePlay(store, (s) => s.selected);
  const drilled = nested && Boolean(picked) && (tab === "inspect" || tab === "code");
  const shown = panels.find((p) => p.id === panel && !p.hidden) ?? null;
  return (
    <div className="spp-inspector">
      <div className="spp-panel-head">
        <div className="spp-seg spp-seg-fill" role="tablist" aria-label="Panel" data-count={panels.filter((p) => !p.hidden).length + tabs.length}>
          {panels.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={shown?.id === p.id}
              aria-description={p.title}
              aria-hidden={p.hidden || undefined}
              tabIndex={p.hidden ? -1 : undefined}
              disabled={p.hidden}
              data-hidden={p.hidden || undefined}
              onClick={() => store.setPanel(p.id)}
            >
              {p.label}
            </button>
          ))}
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={!shown && lit === t.id}
              // Docked: coming back from another tab returns to where you were; on the tab, it's back to the map.
              onClick={() => (nested && shown ? store.setPanel("tools") : store.setTab(t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="spp-icon-btn spp-drawer-close" aria-label="Close" onClick={() => store.setDrawer(null)}>
          <UI name="close" size={15} />
        </button>
      </div>
      <div className="spp-inspector-body">
        {shown ? (
          shown.render()
        ) : status !== "ready" ? (
          <LockedOrLoading />
        ) : drilled ? (
          <div className="spp-drill">
            {/* Inside an item: back out to the map, or switch between its properties and its SwiftUI. */}
            <div className="spp-drill-bar">
              <button type="button" className="spp-drill-back" onClick={() => store.setTab("map")} title="Back to the map (Esc steps out one level)">
                <UI name="left" size={13} />
                Map
              </button>
              <div className="spp-subtabs" role="tablist" aria-label="Item view">
                <button type="button" role="tab" aria-selected={tab === "inspect"} onClick={() => store.setTab("inspect")}>Properties</button>
                <button type="button" role="tab" aria-selected={tab === "code"} onClick={() => store.setTab("code")}>SwiftUI</button>
              </div>
            </div>
            {tab === "code" ? (
              <Suspense fallback={<div className="spp-pane-loading" />}>
                <CodePanel onBuild={onBuild} />
              </Suspense>
            ) : (
              <InspectTab onBuild={onBuild} compact />
            )}
          </div>
        ) : nested ? (
          <Suspense fallback={<div className="spp-pane-loading" />}>
            <BuildMap />
            <RemixActions onBuild={onBuild} />
          </Suspense>
        ) : tab === "inspect" ? (
          <InspectTab onBuild={onBuild} />
        ) : (
          <Suspense fallback={<div className="spp-pane-loading" />}>{tab === "code" ? <CodePanel onBuild={onBuild} /> : <BuildMap />}</Suspense>
        )}
      </div>
    </div>
  );
});

/** Under the map: put the remix back as it came, save it, or build it. */
function RemixActions({ onBuild }: { onBuild: () => void }) {
  const { store } = usePlayground();
  const remixed = usePlay(store, (s) => s.remixed);
  const status = usePlay(store, (s) => s.status);
  if (status !== "ready") return null;
  return (
    <section className="spp-section spp-about-foot spp-map-foot">
      {remixed ? (
        <button type="button" className="spp-btn spp-btn-sm spp-btn-icon" onClick={() => store.reset()} aria-label="Reset to original" title="Reset to original">
          <UI name="restart" size={13} />
        </button>
      ) : null}
      <SaveRemix />
      <button type="button" className="spp-btn spp-btn-sm spp-btn-primary" onClick={onBuild}>
        <UI name="hammer" size={13} />
        Build it
      </button>
    </section>
  );
}

function LockedOrLoading() {
  const { store } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const status = usePlay(store, (s) => s.status);
  if (!entry || status === "loading") return <div className="spp-pane-loading" />;
  return <About />;
}

function InspectTab({ onBuild, compact = false }: { onBuild: () => void; compact?: boolean }) {
  const { store } = usePlayground();
  const selected = usePlay(store, (s) => s.selected);
  const project = usePlay(store, (s) => s.project);
  if (!project) return null;
  const screen = selected ? project.screens.find((s) => s.id === selected.screenId) : null;
  const node = screen && selected ? findNode(screen.root, selected.nodeId) : null;
  if (!screen || !node) return <About onBuild={onBuild} compact={compact} />;
  return <NodeInspector key={node.id} project={project} screen={screen} node={node} />;
}

// ---------------------------------------------------------------- About (nothing selected)

/**
 * With nothing picked: what the screen is made of and how to take it apart. `compact` (docked, where
 * Screens and Style have their own tabs) keeps only that, plus save and reset; the full version also
 * explains the entry, what to try, how it behaves, and its look.
 */
function About({ onBuild, compact = false }: { onBuild?: () => void; compact?: boolean }) {
  const { store, host } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const remixed = usePlay(store, (s) => s.remixed);
  const status = usePlay(store, (s) => s.status);
  if (!entry) return null;
  const kind = CATALOG_KINDS.find((k) => k.id === entry.kind)!;
  const screen = project?.screens.find((s) => s.id === current) ?? project?.screens[0] ?? null;
  const parts = project && screen ? componentsIn({ screens: [screen] }, host.registry) : [];
  return (
    <div className="spp-about" data-compact={compact || undefined}>
      {compact ? (
        <p className="spp-about-hint">
          Click any part of the phone to see how it&apos;s built and change it. Or pick one below.
        </p>
      ) : (
      <>
      <header className="spp-about-head">
        <p className="spp-eyebrow">{kind.singular} · {entry.category}</p>
        <h1 className="spp-about-title">{entry.title}</h1>
        <p className="spp-about-lede">{entry.description}</p>
      </header>

      {entry.try.length ? (
        <section className="spp-section">
          <h2 className="spp-label">Try it</h2>
          <ol className="spp-try-list">
            {entry.try.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>
      ) : null}

      {entry.interactions.length ? (
        <section className="spp-section">
          <h2 className="spp-label">How it behaves</h2>
          <ul className="spp-behaviours">
            {entry.interactions.map((id) => {
              const x = interactionById(id);
              if (!x) return null;
              return (
                <li key={id}>
                  <strong>{x.name}</strong>
                  <span>{x.feel}</span>
                  <code>{x.swiftui.slice(0, 2).join(" · ")}</code>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      </>
      )}

      {status === "ready" && parts.length ? (
        <section className="spp-section">
          <h2 className="spp-label">
            Built from
            {screen && project && project.screens.length > 1 ? <span className="spp-label-note">{screenTitle(screen)}</span> : null}
          </h2>
          <ul className="spp-parts">
            {parts.map((def) => (
              <li key={def.id}>
                <button
                  type="button"
                  onClick={() => {
                    const hit = screen ? firstNodeOf({ screens: [screen] }, def.id) : null;
                    if (hit) store.select(hit.nodeId, hit.screenId);
                  }}
                >
                  <span className="spp-part-tile"><KindIcon id={def.id} symbol={def.icon} size={14} /></span>
                  <span className="spp-part-name">{def.name}</span>
                  {def.source ? <span className="spp-sp-tag" title="A Swift Pieces component">SP</span> : <span className="spp-native-tag">SwiftUI</span>}
                </button>
              </li>
            ))}
          </ul>
          {compact ? null : <p className="spp-hint">Pick a part, or switch to <button type="button" className="spp-link" onClick={() => store.setMode("inspect")}>Inspect</button> and click the screen.</p>}
        </section>
      ) : null}

      {status === "ready" && project && !compact ? <LookSection project={project} /> : null}
      {status === "ready" && host.remixWithAI && screen ? <AskRemix screen={screen} /> : null}

      {status === "ready" ? (
        <section className="spp-section spp-about-foot">
          {remixed ? (
            <button type="button" className="spp-btn spp-btn-sm" onClick={() => store.reset()}>
              <UI name="restart" size={13} />
              Reset to original
            </button>
          ) : null}
          <SaveRemix />
          {onBuild ? (
            <button type="button" className="spp-btn spp-btn-sm" onClick={onBuild}>
              <UI name="hammer" size={13} />
              Build it
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** The whole screen's look: one of the house looks (or plain iOS), then accent, appearance, font, corners. */
export function LookSection({ project }: { project: Project }) {
  const { store } = usePlayground();
  const theme = project.theme;
  const look = theme ? lookById(theme.look) : null;
  const patch = (p: Partial<Theme>) => theme && store.setTheme({ ...theme, ...p });
  return (
    <section className="spp-section">
      <h2 className="spp-label">Remix the look</h2>
      <div className="spp-looks" role="radiogroup" aria-label="Look">
        <button type="button" role="radio" aria-checked={!theme} className="spp-look" onClick={() => store.setTheme(undefined)} title="Plain iOS system styling">
          <span className="spp-look-swatch" style={{ background: "linear-gradient(135deg, #0A84FF 0 50%, #1c1c1e 50%)" }} />
          <span>iOS</span>
        </button>
        {looks.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={theme?.look === l.id} className="spp-look" onClick={() => store.setTheme({ ...themeFromLook(l.id), ...(theme ? { appearance: theme.appearance } : {}) })} title={l.description}>
            <span className="spp-look-swatch" style={{ background: `linear-gradient(135deg, ${l.dark.accent} 0 50%, ${l[l.signature].bg} 50%)` }} />
            <span>{l.name}</span>
          </button>
        ))}
      </div>
      {theme && look ? (
        <div className="spp-fields">
          <div className="spp-field">
            <span className="spp-field-label">Accent</span>
            <div className="spp-swatches" role="radiogroup" aria-label="Accent">
              <button type="button" role="radio" aria-checked={theme.accent === -1} className="spp-swatch" title="The look's own" style={{ ["--sw" as string]: look.dark.accent }} onClick={() => patch({ accent: -1 })} />
              {look.dark.tiles.map((c, i) => (
                <button key={i} type="button" role="radio" aria-checked={theme.accent === i} className="spp-swatch" style={{ ["--sw" as string]: c }} onClick={() => patch({ accent: i })} aria-label={`Accent ${i + 1}`} />
              ))}
            </div>
          </div>
          <Seg label="Appearance" value={theme.appearance} options={[["system", "Auto"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => patch({ appearance: v as Theme["appearance"] })} />
          <Seg label="Font" value={theme.font} options={[["default", "Default"], ["rounded", "Rounded"], ["serif", "Serif"], ["mono", "Mono"]]} onChange={(v) => patch({ font: v as Theme["font"] })} />
          <Seg label="Corners" value={theme.corners} options={[["tight", "Tight"], ["standard", "Standard"], ["soft", "Soft"]]} onChange={(v) => patch({ corners: v as Theme["corners"] })} />
          <Seg label="Density" value={theme.density} options={[["compact", "Compact"], ["regular", "Regular"], ["roomy", "Roomy"]]} onChange={(v) => patch({ density: v as Theme["density"] })} />
        </div>
      ) : null}
    </section>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="spp-field">
      <span className="spp-field-label">{label}</span>
      <div className="spp-seg spp-seg-fill" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function SaveRemix() {
  const { store, host } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  // With accounts, saving is the top bar's Save (to the account); this browser-only save would only
  // confuse, since it never reaches the account.
  if (!entry || host.cloudSave || host.links.signIn) return null;
  if (!naming) {
    return (
      <button type="button" className="spp-btn spp-btn-sm" onClick={() => { setName(`My ${entry.title}`); setNaming(true); }}>
        <UI name="bookmark" size={13} />
        Save remix
      </button>
    );
  }
  return (
    <form
      className="spp-save"
      onSubmit={(e) => {
        e.preventDefault();
        if (store.saveRemix(name.trim() || entry.title)) setNaming(false);
      }}
    >
      <input className="spp-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Remix name" autoFocus />
      <button type="submit" className="spp-btn spp-btn-sm spp-btn-primary">Save</button>
      <button type="button" className="spp-icon-btn spp-icon-btn-sm" aria-label="Cancel" onClick={() => setNaming(false)}><UI name="close" size={13} /></button>
    </form>
  );
}

/** Pro: describe a change; the answer is a new screen tree, validated before it reaches the preview. */
function AskRemix({ screen }: { screen: Screen }) {
  const { store, host, track } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = ["Make it feel more native", "Make the interaction more playful", "Turn this into a paywall"];
  const run = async (text: string) => {
    if (!host.remixWithAI || !text.trim() || busy) return;
    setBusy(true);
    try {
      const raw = await host.remixWithAI(text.trim(), screen.root, { entry: entry ? `${entry.kind}/${entry.slug}` : "" });
      const issues: string[] = [];
      const root = validateScreenRoot(raw, host.registry, host.limits, issues);
      const p = store.getState().project;
      if (p) {
        store.replaceScreenRoot(screen.id, root);
        track("component_remixed", { component: "screen", via: "ai", kind: entry?.kind ?? "", slug: entry?.slug ?? "" });
      }
      setPrompt("");
    } catch {
      store.notify("That remix didn't come through. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="spp-section">
      <h2 className="spp-label">Ask for a remix</h2>
      <form className="spp-ask" onSubmit={(e) => { e.preventDefault(); void run(prompt); }}>
        <input className="spp-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Make it feel calmer" maxLength={200} disabled={busy} aria-label="Describe a remix" />
        <button type="submit" className="spp-btn spp-btn-sm" disabled={busy || !prompt.trim()}>{busy ? <span className="spb-spinner" /> : "Remix"}</button>
      </form>
      <div className="spp-chips">
        {suggestions.map((s) => <button key={s} type="button" className="spp-chip" disabled={busy} onClick={() => void run(s)}>{s}</button>)}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- A selected component

const NodeInspector = memo(function NodeInspector({ project, screen, node }: { project: Project; screen: Screen; node: ScreenNode }) {
  const { store, host, track, navigate } = usePlayground();
  const def = host.registry.get(node.component);
  const [part, setPart] = useState<string | null>(null);
  const generated = useGenerated(project, screen);
  if (!def) return null;
  const props = { ...defaultProps(def), ...node.props };
  const isRoot = node.id === screen.root.id;
  const anatomy = anatomyOf(def);
  const partProps = part ? new Set(anatomy.find((a) => a.part === part)?.props ?? []) : null;
  const locked = (p: PropertyDefinition) => Boolean(p.pro && !host.limits.advancedProperties);
  const shown = def.properties.filter((p) => propertyVisible(p, props) && (!partProps || partProps.has(p.id)));
  const groups = new Map<PropertyGroup, PropertyDefinition[]>();
  for (const p of shown) {
    const g = propertyGroup(p, def);
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  const path = pathTo(screen.root, node.id).map((id) => findNode(screen.root, id)!).filter(Boolean);
  const snippet = generated ? nodeSnippet(generated, node.id) : null;
  const docs = host.links.component(def);
  const element = host.catalog.forComponent(def.id);
  const entry = store.getState().entry;
  const onLocked = () => {
    track("pro_gate_viewed", { from: "property", component: def.id });
    store.notify("Motion and fine-tuning controls come with Swift Pieces Pro.");
  };
  const add = def.source ? `npx swiftpieces add ${def.source.name}` : null;

  return (
    <div className="spp-node">
      <nav className="spp-path" aria-label="Where this is">
        {path.map((n, i) => {
          const d = host.registry.get(n.component);
          const last = i === path.length - 1;
          return (
            <span key={n.id} className="spp-path-item">
              {i ? <UI name="right" size={11} /> : null}
              {last ? <strong>{i === 0 ? screenTitle(screen) : d?.name}</strong> : <button type="button" onClick={() => store.select(i === 0 ? screen.root.id : n.id, screen.id)}>{i === 0 ? screenTitle(screen) : d?.name}</button>}
            </span>
          );
        })}
        <button type="button" className="spp-icon-btn spp-icon-btn-sm spp-path-close" aria-label="Deselect" onClick={() => store.select(null)}>
          <UI name="close" size={13} />
        </button>
      </nav>

      <header className="spp-node-head">
        <span className="spp-node-tile"><KindIcon id={def.id} symbol={def.icon} size={15} /></span>
        <div className="spp-node-id">
          <h2 className="spp-node-title">
            {isRoot ? "Screen" : def.name}
            {def.availability === "pro" ? <span className="spp-pro-tag">Pro</span> : null}
          </h2>
          <p className="spp-node-kind">{def.source ? "Swift Pieces component" : "Native SwiftUI"}</p>
        </div>
      </header>
      <p className="spp-node-desc">{isRoot ? "The screen itself: its background, title, spacing, and how it sits when presented." : def.description}</p>

      {!isRoot ? (
        <section className="spp-section">
          <h3 className="spp-label">Parts</h3>
          {/* Narrows the settings below to one part; All shows everything. */}
          <div className="spp-part-filter" role="group" aria-label="Parts">
            <button type="button" aria-pressed={part === null} onClick={() => setPart(null)}>All</button>
            {anatomy.map((a) => (
              <button key={a.part} type="button" aria-pressed={part === a.part} onClick={() => setPart(part === a.part ? null : a.part)}>{a.part}</button>
            ))}
          </div>
        </section>
      ) : null}

      {def.variants?.length || def.states?.length ? (
        <section className="spp-section">
          {def.variants?.length ? (
            <>
              <h3 className="spp-label">Variants</h3>
              <div className="spp-part-filter">
                {def.variants.map((v) => <button key={v.id} type="button" aria-pressed={Object.entries(v.props).every(([k, x]) => props[k] === x)} onClick={() => store.applyProps(node.id, v.props, `variant:${v.id}`)}>{v.label}</button>)}
              </div>
            </>
          ) : null}
          {def.states?.length ? (
            <>
              <h3 className="spp-label">States</h3>
              <div className="spp-part-filter">
                {def.states.map((v) => <button key={v.id} type="button" aria-pressed={Object.entries(v.props).every(([k, x]) => props[k] === x)} onClick={() => store.applyProps(node.id, v.props, `state:${v.id}`)}>{v.label}</button>)}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
        <section key={g} className="spp-section spp-props">
          <h3 className="spp-label">{GROUP_LABELS[g]}</h3>
          <div className="spp-fields">
            {groups.get(g)!.map((p) => (
              <Field key={p.id} p={p} value={props[p.id]} locked={locked(p)} onLocked={onLocked} screens={project.screens} ownScreenId={screen.id} onChange={(v) => !locked(p) && store.setProp(node.id, p.id, v)} />
            ))}
          </div>
        </section>
      ))}
      {!shown.length ? <p className="spp-hint">Nothing to change here. This part is structure.</p> : null}

      {isRoot && project.screens.length > 1 ? <TabBarSection project={project} screen={screen} /> : null}

      {node.children?.length ? (
        <section className="spp-section">
          <h3 className="spp-label">Contains</h3>
          <ul className="spp-parts">
            {node.children.map((c) => {
              const d = host.registry.get(c.component);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => store.select(c.id, screen.id)}>
                    <span className="spp-part-tile"><KindIcon id={c.component} symbol={d?.icon} size={14} /></span>
                    <span className="spp-part-name">{d?.name ?? c.component}</span>
                    <span className="spp-part-sum">{nodeSummary(c)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {def.interactions?.length ? (
        <section className="spp-section">
          <h3 className="spp-label">How it behaves</h3>
          <ul className="spp-behaviours">
            {def.interactions.map((id) => {
              const x = interactionById(id);
              return x ? (
                <li key={id}>
                  <strong>{x.name}</strong>
                  <span>{x.feel}</span>
                  <code>{x.swiftui.slice(0, 3).join(" · ")}</code>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}


      <section className="spp-section">
        <div className="spp-label-row">
          <h3 className="spp-label">SwiftUI</h3>
          {snippet ? <CopyButton text={snippet} onCopied={() => track("code_copied", { scope: "component", component: def.id })} /> : null}
        </div>
        {snippet ? <pre className="spp-snippet"><code>{snippet}</code></pre> : <p className="spp-hint">No code for this part on its own.</p>}
        <div className="spp-node-links">
          <button type="button" className="spp-link" onClick={() => store.setTab("code")}>Full screen code</button>
          {docs ? <a className="spp-link" href={docs} onClick={() => track("component_opened", { component: def.id, via: "docs" })}>Documentation</a> : null}
          {element && entry && !host.sidebar && (element.kind !== entry.kind || element.slug !== entry.slug) ? (
            <button type="button" className="spp-link" onClick={() => { track("component_opened", { component: def.id, via: "playground" }); navigate(element.kind, element.slug, { select: def.id }); }}>
              Open {def.name} on its own
            </button>
          ) : null}
        </div>
        {add ? (
          <div className="spp-add">
            <code>{add}</code>
            <CopyButton text={add} label="Copy" className="spp-icon-btn spp-icon-btn-sm spp-copy-icon" onCopied={() => track("code_copied", { scope: "install", component: def.id })} />
          </div>
        ) : !isRoot ? (
          <p className="spp-hint">Native SwiftUI: nothing to install.</p>
        ) : null}
      </section>
    </div>
  );
});

export type { SwiftPieceDefinition };

const TAB_FIELDS: Record<"on" | "title" | "icon", PropertyDefinition> = {
  on: { id: "tab", label: "In the tab bar", type: "boolean", defaultValue: false, hint: "Tab bar screens are peers. Everything else is pushed or presented from them." },
  title: { id: "tabTitle", label: "Tab title", type: "text", defaultValue: "", maxLength: 24 },
  icon: { id: "tabIcon", label: "Tab symbol", type: "icon", defaultValue: "house" },
};

/** The screen's place in the app: in the tab bar (with its title and symbol) or reached from it. */
function TabBarSection({ project, screen }: { project: Project; screen: Screen }) {
  const { store } = usePlayground();
  const on = project.shell === "tabs" && Boolean(screen.tab);
  const full = !on && project.shell === "tabs" && project.screens.filter((s) => s.tab).length >= MAX_TABS;
  return (
    <section className="spp-section spp-props">
      <h3 className="spp-label">Tab bar</h3>
      <div className="spp-fields">
        <Field p={full ? { ...TAB_FIELDS.on, hint: `The tab bar holds up to ${MAX_TABS} screens. Take one out first.` } : TAB_FIELDS.on} value={on} locked={false} onChange={(v) => store.setInTabBar(screen.id, v === true)} />
        {on && screen.tab ? (
          <>
            <Field p={TAB_FIELDS.title} value={screen.tab.title} locked={false} onChange={(v) => store.setTabItem(screen.id, { title: String(v) })} />
            <Field p={TAB_FIELDS.icon} value={screen.tab.icon} locked={false} onChange={(v) => v !== "none" && store.setTabItem(screen.id, { icon: String(v) })} />
          </>
        ) : null}
      </div>
    </section>
  );
}
