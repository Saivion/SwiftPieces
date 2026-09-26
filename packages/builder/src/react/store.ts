// The builder's state: one small external store read through selectors, so a property edit
// re-renders the edited node (and the nodes on its path), not the whole preview, the library or
// the code view. Undo and redo keep whole-project snapshots; they are cheap because every edit
// shares all untouched subtrees with the previous version.
import { useSyncExternalStore } from "react";
import {
  createNode, duplicateNode, findNode, insertNode, moveInto, moveSibling, newId, parentOf, removeNode, replaceProps, updateProp,
  type BuilderLimits, type ComponentRegistry, type Project, type PropValue, type Screen, type ScreenNode, countNodes,
} from "../index.js";

export type Persona = "first-app" | "web" | "swiftui" | "explore";
export type Panel = "preview" | "code" | "split";

export type BuilderState = {
  project: Project;
  screenId: string;
  selectedId: string | null;
  /** Transient message ("Added Button", "This screen has the maximum…"). */
  notice: { text: string; tone: "info" | "warn" } | null;
  panel: Panel;
  scheme: "dark" | "light";
};

type Listener = () => void;

export type Store = ReturnType<typeof createStore>;

const COALESCE_MS = 600;
const HISTORY = 100;

export function createStore(initial: BuilderState, deps: { registry: ComponentRegistry; limits: BuilderLimits; onChange?: (p: Project) => void; onEvent?: (name: string, props?: Record<string, string | number>) => void }) {
  let state = initial;
  const listeners = new Set<Listener>();
  const past: Project[] = [];
  const future: Project[] = [];
  let lastEditKey = "";
  let lastEditAt = 0;

  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<BuilderState>) => {
    state = { ...state, ...patch };
    emit();
  };

  const screen = (): Screen => state.project.screens.find((s) => s.id === state.screenId) ?? state.project.screens[0];

  /** Replaces the current screen's root, recording history. `key` coalesces rapid edits (typing, sliders). */
  function commitRoot(root: ScreenNode, key?: string) {
    const current = screen();
    if (root === current.root) return;
    const now = Date.now();
    if (!(key && key === lastEditKey && now - lastEditAt < COALESCE_MS)) {
      past.push(state.project);
      if (past.length > HISTORY) past.shift();
    }
    future.length = 0;
    lastEditKey = key ?? "";
    lastEditAt = now;
    const project: Project = { ...state.project, updatedAt: now, screens: state.project.screens.map((s) => (s.id === current.id ? { ...s, root } : s)) };
    state = { ...state, project };
    emit();
    deps.onChange?.(project);
  }

  function commitProject(project: Project, patch: Partial<BuilderState> = {}) {
    past.push(state.project);
    if (past.length > HISTORY) past.shift();
    future.length = 0;
    lastEditKey = "";
    state = { ...state, ...patch, project: { ...project, updatedAt: Date.now() } };
    emit();
    deps.onChange?.(state.project);
  }

  function notify(text: string, tone: "info" | "warn" = "info") {
    set({ notice: { text, tone } });
  }

  return {
    getState: () => state,
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    screen,
    select(id: string | null) {
      if (state.selectedId !== id) set({ selectedId: id });
    },
    setPanel: (panel: Panel) => set({ panel }),
    setScheme: (scheme: "dark" | "light") => set({ scheme }),
    notify,
    clearNotice: () => state.notice && set({ notice: null }),

    /** Adds a component near the selection: inside a selected container, else after the selected node. */
    add(componentId: string, props?: Record<string, PropValue>): string | null {
      const def = deps.registry.get(componentId);
      if (!def) return null;
      if (!deps.registry.usable(def, deps.limits)) {
        notify(`${def.name} is part of SwiftPieces Pro.`, "warn");
        deps.onEvent?.("pro_cta_clicked", { from: "locked_component", component: def.id });
        return null;
      }
      const root = screen().root;
      if (countNodes(root) >= deps.limits.maxNodesPerScreen) {
        notify(`This screen has the maximum of ${deps.limits.maxNodesPerScreen} components on this plan.`, "warn");
        return null;
      }
      const node = createNode(def, props);
      const sel = state.selectedId ? findNode(root, state.selectedId) : null;
      const selDef = sel ? deps.registry.get(sel.component) : undefined;
      let next: ScreenNode;
      if (sel && selDef?.container && (!selDef.container.accepts?.length || selDef.container.accepts.includes(def.id))) {
        next = insertNode(root, sel.id, node);
      } else if (sel && sel.id !== root.id) {
        const parent = parentOf(root, sel.id)!;
        next = insertNode(root, parent.id, node, (parent.children ?? []).findIndex((c) => c.id === sel.id) + 1);
      } else {
        next = insertNode(root, root.id, node);
      }
      commitRoot(next);
      set({ selectedId: node.id });
      notify(`Added ${def.name}`);
      deps.onEvent?.("component_selected", { component: def.id, via: "add" });
      return node.id;
    },
    setProp(id: string, prop: string, value: PropValue) {
      commitRoot(updateProp(screen().root, id, prop, value), `${id}:${prop}`);
    },
    applyVariant(id: string, props: Record<string, PropValue>) {
      commitRoot(replaceProps(screen().root, id, props));
    },
    remove(id: string) {
      const root = screen().root;
      if (id === root.id) return;
      const parent = parentOf(root, id);
      const siblings = parent?.children ?? [];
      const i = siblings.findIndex((c) => c.id === id);
      const nextSel = siblings[i + 1]?.id ?? siblings[i - 1]?.id ?? parent?.id ?? null;
      commitRoot(removeNode(root, id));
      set({ selectedId: nextSel });
    },
    duplicate(id: string) {
      const root = screen().root;
      if (countNodes(root) + countNodes(findNode(root, id) ?? root) > deps.limits.maxNodesPerScreen) {
        notify(`This screen has the maximum of ${deps.limits.maxNodesPerScreen} components on this plan.`, "warn");
        return;
      }
      const r = duplicateNode(root, id);
      commitRoot(r.root);
      if (r.id) set({ selectedId: r.id });
    },
    move(id: string, delta: -1 | 1) {
      commitRoot(moveSibling(screen().root, id, delta));
    },
    moveInto(id: string, parentId: string) {
      commitRoot(moveInto(screen().root, id, parentId));
    },
    /** Wraps a node in a new vertical stack, the non-drag way to group things. */
    wrap(id: string, containerId = "vstack") {
      const root = screen().root;
      const def = deps.registry.get(containerId);
      const node = findNode(root, id);
      const parent = parentOf(root, id);
      if (!def || !node || !parent) return;
      const box = createNode(def, {}, [node]);
      const index = (parent.children ?? []).findIndex((c) => c.id === id);
      commitRoot(insertNode(removeNode(root, id), parent.id, box, index));
      set({ selectedId: box.id });
    },
    replaceProject(project: Project, opts: { select?: string | null } = {}) {
      commitProject(project, { screenId: project.screens[0].id, selectedId: opts.select ?? null });
    },
    renameProject(name: string) {
      commitProject({ ...state.project, name });
    },
    setScreen(screenId: string) {
      set({ screenId, selectedId: null });
    },
    addScreen(screen: Screen) {
      if (state.project.screens.length >= deps.limits.maxScreens) {
        notify(deps.limits.tier === "free" ? "More screens in one project is a Pro feature." : `Projects hold up to ${deps.limits.maxScreens} screens.`, "warn");
        return false;
      }
      commitProject({ ...state.project, screens: [...state.project.screens, screen] }, { screenId: screen.id, selectedId: null });
      return true;
    },
    removeScreen(screenId: string) {
      if (state.project.screens.length <= 1) return;
      const screens = state.project.screens.filter((s) => s.id !== screenId);
      commitProject({ ...state.project, screens }, { screenId: screens[0].id, selectedId: null });
    },
    renameScreen(screenId: string, name: string) {
      commitProject({ ...state.project, screens: state.project.screens.map((s) => (s.id === screenId ? { ...s, name } : s)) });
    },
    setShell(shell: Project["shell"]) {
      commitProject({ ...state.project, shell });
    },
    undo() {
      const prev = past.pop();
      if (!prev) return;
      future.push(state.project);
      lastEditKey = "";
      const screenId = prev.screens.some((s) => s.id === state.screenId) ? state.screenId : prev.screens[0].id;
      state = { ...state, project: prev, screenId };
      emit();
      deps.onChange?.(prev);
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(state.project);
      const screenId = next.screens.some((s) => s.id === state.screenId) ? state.screenId : next.screens[0].id;
      state = { ...state, project: next, screenId };
      emit();
      deps.onChange?.(next);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    newScreenId: () => newId("s"),
  };
}

/** Subscribes to a slice of the store; re-renders only when the selected value changes (Object.is). */
export function useStore<T>(store: Store, selector: (s: BuilderState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}
