// Placing the Inspect outlines (hover and selection) over a component, shared by the running phone
// and the All canvas: the outline follows the component's visible corners, and the hover's name tag
// moves out of the selection's way.

/**
 * An element's top-left corner in its own pixels, as it is drawn: percentages resolved, and never more
 * than half its shorter side (a pill's corner is half its height, not its declared 999px).
 */
function cornerOf(node: HTMLElement): number {
  const v = getComputedStyle(node).borderTopLeftRadius;
  const n = parseFloat(v) || 0;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const px = v.trim().endsWith("%") ? (n * Math.min(w, h)) / 100 : n;
  return Math.max(0, Math.min(px, w / 2, h / 2));
}

/**
 * The corner the outline should follow, in the element's own (unscaled) pixels: its own; a screen's
 * is the phone's; a container with square corners takes the corner of a child that fills its corner
 * (a grid of rounded tiles reads as rounded), and is never rounder than its own shape allows.
 */
export function visibleRadius(el: HTMLElement): number {
  const cap = (r: number) => Math.max(0, Math.min(r, el.offsetWidth / 2, el.offsetHeight / 2));
  const own = cornerOf(el);
  if (own) return own;
  if (el.dataset.component === "screen") {
    const phone = el.closest<HTMLElement>(".spb-phone");
    return phone ? cap(cornerOf(phone)) : 0;
  }
  const a = el.getBoundingClientRect();
  let child = el.firstElementChild as HTMLElement | null;
  // Down through wrappers that share the container's corner, a few levels at most.
  for (let depth = 0; child && depth < 3; depth++) {
    const b = child.getBoundingClientRect();
    if (Math.abs(b.left - a.left) > 1.5 || Math.abs(b.top - a.top) > 1.5) break;
    const r = cornerOf(child);
    // Only a child that fills the corner on both sides lends it (not a thin bar along the top).
    if (r && b.height >= r * 2 - 1 && b.width >= r * 2 - 1) return cap(Math.min(r, 24));
    child = child.firstElementChild as HTMLElement | null;
  }
  return 0;
}

/**
 * What of an element can actually be seen: its box cut by every ancestor that clips (a pager's
 * other pages, a scroll view's hidden rows, the phone's own edge), up to `frame`. Null when none of it.
 */
export function visibleRect(el: HTMLElement, frame: HTMLElement): DOMRect | null {
  const r = el.getBoundingClientRect();
  let left = r.left;
  let top = r.top;
  let right = r.right;
  let bottom = r.bottom;
  for (let p = el.parentElement; p && p !== frame; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === "visible" && cs.overflowY === "visible" && !/paint|strict|content/.test(cs.contain)) continue;
    const c = p.getBoundingClientRect();
    left = Math.max(left, c.left);
    top = Math.max(top, c.top);
    right = Math.min(right, c.right);
    bottom = Math.min(bottom, c.bottom);
    if (right - left < 1 || bottom - top < 1) return null;
  }
  if (right - left < 1 || bottom - top < 1) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Scrolls every scroll view between `el` and `frame` (a screen's content, a carousel) so `el` sits in
 * the middle of it, the way a finger would scroll to it. Works under a scaled canvas: scroll offsets
 * are in the element's own points, so the on-screen distance is divided by that layer's scale.
 */
export function revealWithin(el: HTMLElement, frame: HTMLElement) {
  for (let p = el.parentElement; p && p !== frame; p = p.parentElement) {
    const cs = getComputedStyle(p);
    const scrollsY = /auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
    const scrollsX = /auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
    if (!scrollsY && !scrollsX) continue;
    const r = el.getBoundingClientRect();
    const c = p.getBoundingClientRect();
    if (scrollsY && (r.top < c.top || r.bottom > c.bottom)) {
      const k = c.height / Math.max(1, p.clientHeight);
      p.scrollTop += (r.top - c.top - (c.height - Math.min(r.height, c.height)) / 2) / k;
    }
    if (scrollsX && (r.left < c.left || r.right > c.right)) {
      const k = c.width / Math.max(1, p.clientWidth);
      p.scrollLeft += (r.left - c.left - (c.width - Math.min(r.width, c.width)) / 2) / k;
    }
  }
}

/** The app's own bars that float over the content: the dock's pill and the system tab bar. */
const BARS = ".spp-dock-inner, .spp-tabbar";

/**
 * Cuts the app's bars out of an outline layer, so an outline passes behind the dock or the tab bar
 * the way the content it outlines does, instead of being drawn over them. The holes are the bars'
 * own rounded shapes, in the layer's local units (the layer may sit in a scaled phone). Rebuilt only
 * when a bar moves; no bars, no mask.
 */
export function maskBars(layer: HTMLElement | null, frame: HTMLElement | null) {
  if (!layer || !frame) return;
  const a = layer.getBoundingClientRect();
  const w = layer.offsetWidth;
  const h = layer.offsetHeight;
  if (!w || !h) return;
  const k = a.width / w;
  let holes = "";
  for (const bar of frame.querySelectorAll<HTMLElement>(BARS)) {
    const r = bar.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // A sheet presented over the bar hides it: outlines on the sheet (or under it) aren't cut there.
    const covered = [...(bar.closest(".spb-phone")?.querySelectorAll<HTMLElement>(".spp-sheet") ?? [])].some((sheet) => {
      const s = sheet.getBoundingClientRect();
      return s.height > 0 && s.top < r.bottom && s.bottom > r.top && s.left < r.right && s.right > r.left;
    });
    if (covered) continue;
    const scale = r.width / Math.max(1, bar.offsetWidth);
    const radius = Math.min((parseFloat(getComputedStyle(bar).borderTopLeftRadius) || 0) * scale, r.height / 2) / k;
    const f = (v: number) => Math.round(v * 10) / 10;
    holes += `<rect x='${f((r.left - a.left) / k)}' y='${f((r.top - a.top) / k)}' width='${f(r.width / k)}' height='${f(r.height / k)}' rx='${f(radius)}'/>`;
  }
  const key = holes && `${w}x${h}:${holes}`;
  if (layer.dataset.mask === key) return;
  layer.dataset.mask = key;
  if (!holes) {
    layer.style.maskImage = layer.style.webkitMaskImage = "";
    return;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><mask id='m'><rect width='100%' height='100%' fill='white'/><g fill='black'>${holes}</g></mask></defs><rect width='100%' height='100%' mask='url(#m)'/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  layer.style.maskImage = layer.style.webkitMaskImage = url;
  layer.style.maskSize = layer.style.webkitMaskSize = `${w}px ${h}px`;
  layer.style.maskRepeat = layer.style.webkitMaskRepeat = "no-repeat";
}

type Placed = { left: number; top: number; width: number; height: number } | null;

/**
 * Places `box` over `el`, in the coordinates of `frame` divided by `scale` (the phone lays out in
 * points and is scaled as one layer; the canvas draws in screen pixels, scale 1). `zoom` converts the
 * element's own radius to the frame (the canvas zoom). Returns where it went, or null when hidden.
 */
export function placeOutline(box: HTMLElement | null, el: HTMLElement | null, frame: HTMLElement | null, scale = 1): Placed {
  if (!box) return null;
  if (!el || !frame) {
    box.style.opacity = "0";
    return null;
  }
  const b = visibleRect(el, frame);
  if (!b) {
    box.style.opacity = "0";
    return null;
  }
  const a = frame.getBoundingClientRect();
  const s = scale || 1;
  const place = { left: (b.left - a.left) / s, top: (b.top - a.top) / s, width: b.width / s, height: b.height / s };
  // Outlines sit 2px outside the component, so their corner is the component's plus 2.
  const zoom = el.getBoundingClientRect().width / Math.max(1, el.offsetWidth) / s;
  if (box.dataset.for !== el.dataset.nodeId || box.dataset.zoom !== zoom.toFixed(3)) {
    box.dataset.for = el.dataset.nodeId ?? "";
    box.dataset.zoom = zoom.toFixed(3);
    box.style.borderRadius = `${Math.max(4, visibleRadius(el) * zoom + 2)}px`;
  }
  box.style.opacity = "1";
  box.style.transform = `translate(${place.left}px, ${place.top}px)`;
  box.style.width = `${place.width}px`;
  box.style.height = `${place.height}px`;
  return place;
}

/**
 * Keeps the hover's name tag out of the selection's way: above its component by default, below it
 * when above would sit on the selected outline (or its tag), hidden when both would.
 */
export function placeHoverTag(box: HTMLElement | null, hover: Placed, selected: Placed) {
  if (!box) return;
  const tag = 20 + 6;
  const hits = (top: number) =>
    Boolean(selected && hover && hover.left < selected.left + selected.width && hover.left + 120 > selected.left && top < selected.top + selected.height && top + tag > selected.top - tag);
  let where = "above";
  if (hover && selected && hits(hover.top - tag)) where = hits(hover.top + hover.height) ? "none" : "below";
  if (box.dataset.tag !== where) box.dataset.tag = where;
}

/** The node's element on the visible screen (the top of the front sheet or stack), if any. */
export function findVisible(phone: HTMLElement, id: string): HTMLElement | null {
  const screens = phone.querySelectorAll<HTMLElement>('.spp-screen[data-role="top"]');
  // Frontmost last: a sheet's top screen comes after the root stack's.
  for (let i = screens.length - 1; i >= 0; i--) {
    if (screens[i].closest(".spp-tab[hidden]")) continue;
    const el = screens[i].querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (el) return el;
  }
  return null;
}
