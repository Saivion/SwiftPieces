// Dragging a component to a new place on its screen, on the phone itself: press it (or the layout
// bar's grip) and drag. It fades where it was, a line shows where it will land among its siblings,
// and its name rides the pointer; letting go moves it there as one undo step and everything slides
// into its new place. A press that never moves is a click, so selecting works the way it did.
import type { ComponentRegistry } from "../../core/registry.js";
import { findNode, parentOf } from "../../core/tree.js";
import { findVisible, visibleRect } from "./outline.js";
import type { PlayStore } from "./store.js";

/** Pixels a press travels before it is a drag. */
const THRESHOLD = 4;
/** Within this many pixels of a scroll view's edge, dragging scrolls it. */
const EDGE = 56;
const EASE = "cubic-bezier(.2, .9, .3, 1.04)";

type DragOpts = {
  store: PlayStore;
  registry: ComponentRegistry;
  phone: HTMLElement;
  /** Where the line and the ghost are drawn: the device's slot, which the phone doesn't clip. */
  slot: HTMLElement;
  nodeId: string;
  event: PointerEvent;
  /** A press that never became a drag. */
  onClick?: () => void;
};

/** Starts watching a press; it becomes a drag once the pointer moves. */
export function startLayoutDrag(o: DragOpts) {
  const project = o.store.getState().project;
  const screen = project?.screens.find((s) => findNode(s.root, o.nodeId));
  const parent = screen ? parentOf(screen.root, o.nodeId) : null;
  const node = screen ? findNode(screen.root, o.nodeId) : null;
  if (!screen || !parent?.children || !node || o.event.button !== 0) return void o.onClick?.();

  const axis = o.registry.get(parent.component)?.container?.axis ?? "v";
  const others = parent.children.filter((c) => c.id !== o.nodeId).map((c) => c.id);
  const from = parent.children.findIndex((c) => c.id === o.nodeId);
  const label = o.registry.get(node.component)?.name ?? node.component;
  const start = { x: o.event.clientX, y: o.event.clientY };
  let pointer = start;
  let live = false;
  let index = from;
  let raf = 0;
  let ghost: HTMLElement | null = null;
  let line: HTMLElement | null = null;

  const begin = () => {
    live = true;
    o.store.hover(null);
    document.documentElement.dataset.sppDragging = "";
    findVisible(o.phone, o.nodeId)?.setAttribute("data-dragging", "");
    ghost = el("div", "spp-drag-ghost is-live");
    ghost.append(el("span", "spp-drag-ghost-mark", "⠿"), el("span", "spp-drag-ghost-text", label));
    line = el("div", "spp-dropline");
    line.dataset.axis = axis;
    o.slot.append(line, ghost);
    tick();
  };

  /** Each frame: where it would land, the line there, the ghost at the pointer, and edge scrolling. */
  /** Where it would land: past every sibling whose middle the pointer has passed. */
  const measure = () => {
    const rects = others.map((id) => findVisible(o.phone, id)?.getBoundingClientRect() ?? null);
    const p = axis === "h" ? pointer.x : pointer.y;
    index = rects.reduce((n, r) => (r && (axis === "h" ? r.left + r.width / 2 : r.top + r.height / 2) < p ? n + 1 : n), 0);
    return rects;
  };

  const tick = () => {
    const a = o.slot.getBoundingClientRect();
    const rects = measure();

    const box = findVisible(o.phone, parent.id);
    const frame = (box && visibleRect(box, o.phone)) ?? o.phone.getBoundingClientRect();
    const prev = rects[index - 1];
    const next = rects[index];
    if (line) {
      if (axis === "h") {
        const x = prev && next ? (prev.right + next.left) / 2 : prev ? prev.right + 3 : next ? next.left - 3 : frame.left + 8;
        const top = Math.min(prev?.top ?? Infinity, next?.top ?? Infinity, frame.bottom);
        const bottom = Math.max(prev?.bottom ?? -Infinity, next?.bottom ?? -Infinity, frame.top);
        place(line, x - a.left - 1, Math.max(top, frame.top) - a.top, 2, Math.min(bottom, frame.bottom) - Math.max(top, frame.top));
      } else {
        const y = prev && next ? (prev.bottom + next.top) / 2 : prev ? prev.bottom + 3 : next ? next.top - 3 : frame.top + 8;
        const left = Math.min(prev?.left ?? Infinity, next?.left ?? Infinity, frame.right);
        const right = Math.max(prev?.right ?? -Infinity, next?.right ?? -Infinity, frame.left);
        place(line, Math.max(left, frame.left) - a.left, Math.min(Math.max(y, frame.top + 2), frame.bottom - 2) - a.top - 1, Math.min(right, frame.right) - Math.max(left, frame.left), 2);
      }
      // Dropping where it already is changes nothing: the line says so by going quiet.
      if (index === from) line.dataset.same = "";
      else delete line.dataset.same;
    }
    if (ghost) ghost.style.transform = `translate(${Math.round(pointer.x - a.left + 14)}px, ${Math.round(pointer.y - a.top + 12)}px)`;

    // Near a scroll view's edge, scroll it, faster the closer the pointer is.
    const scroller = scrollerOf(findVisible(o.phone, o.nodeId), o.phone);
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      const up = pointer.y - r.top;
      const down = r.bottom - pointer.y;
      if (up < EDGE) scroller.scrollTop -= Math.ceil(((EDGE - up) / EDGE) * 14);
      else if (down < EDGE) scroller.scrollTop += Math.ceil(((EDGE - down) / EDGE) * 14);
    }
    raf = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
    if (!live && Math.hypot(pointer.x - start.x, pointer.y - start.y) > THRESHOLD) begin();
  };
  const finish = (commit: boolean) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    cancelAnimationFrame(raf);
    ghost?.remove();
    line?.remove();
    findVisible(o.phone, o.nodeId)?.removeAttribute("data-dragging");
    delete document.documentElement.dataset.sppDragging;
    if (!live) return void (commit && o.onClick?.());
    // The pointer may have moved since the last frame.
    if (commit) measure();
    if (commit && index !== from) slideInto(o.phone, [o.nodeId, ...others], () => o.store.moveNodeTo(o.nodeId, parent.id, index));
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    finish(false);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey, true);
}

/**
 * Runs `change`, then slides each of `ids` from where it was to where it lands (FLIP), in its own
 * pixels so the phone's scale and any zoom between are accounted for. Also used by Move up/down.
 */
export function slideInto(phone: HTMLElement | null, ids: string[], change: () => void) {
  if (!phone || matchMedia("(prefers-reduced-motion: reduce)").matches) return change();
  const before = new Map<string, DOMRect>();
  for (const id of ids) {
    const e = findVisible(phone, id);
    if (e) before.set(id, e.getBoundingClientRect());
  }
  change();
  // The store's update has rendered by the next frame, and that frame hasn't painted yet.
  requestAnimationFrame(() => {
    for (const [id, r] of before) {
      const e = findVisible(phone, id);
      if (!e) continue;
      const b = e.getBoundingClientRect();
      const zoom = e.offsetWidth ? b.width / e.offsetWidth : 1;
      const dx = (r.left - b.left) / zoom;
      const dy = (r.top - b.top) / zoom;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 340, easing: EASE });
    }
  });
}

function el(tag: string, className: string, text?: string) {
  const n = document.createElement(tag);
  n.className = className;
  if (text) n.textContent = text;
  return n;
}

function place(n: HTMLElement, x: number, y: number, w: number, h: number) {
  n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  n.style.width = `${Math.max(0, Math.round(w))}px`;
  n.style.height = `${Math.max(0, Math.round(h))}px`;
}

/** The scroll view a component sits in, inside the phone, if any. */
function scrollerOf(from: HTMLElement | null, phone: HTMLElement): HTMLElement | null {
  for (let p = from?.parentElement ?? null; p && p !== phone; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}
