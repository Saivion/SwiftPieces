"use client";
// Editing a screen's layout where it is: a small bar that rides on the selected component (it is
// the selection's name tag, grown into tools). Move it, swap it for another component in the same
// place, copy it, delete it, or add one after it. Adding and swapping open one menu that leads with
// what this app is already built from, so a reworked screen keeps the foundation its siblings share.
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Project, ScreenNode, SwiftPieceDefinition } from "../../core/schema.js";
import { findNode, parentOf } from "../../core/tree.js";
import { KindIcon, UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { slideInto, startLayoutDrag } from "./layout-drag.js";
import { findVisible } from "./outline.js";
import { usePlay } from "./store.js";

/** The everyday components offered before anything is typed, after the app's own. */
const BASICS = ["text", "button", "card", "row", "image", "toggle", "divider", "spacer", "hstack", "vstack"];
const GAP = 8;

type Menu = { mode: "add" | "swap" } | null;

export const SelectionBar = memo(function SelectionBar({ phoneRef, slotRef }: { phoneRef: RefObject<HTMLDivElement | null>; slotRef: RefObject<HTMLDivElement | null> }) {
  const { store, host } = usePlayground();
  const selected = usePlay(store, (s) => (s.mode === "inspect" ? s.selected : null));
  const project = usePlay(store, (s) => s.project);
  const bar = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu>(null);
  // Where the bar sits (above its component, or below when there is no room) and which way its menu opens.
  const [place, setPlace] = useState<{ below: boolean; up: boolean }>({ below: false, up: false });

  const screen = selected && project ? project.screens.find((s) => s.id === selected.screenId) ?? null : null;
  const node = screen && selected ? findNode(screen.root, selected.nodeId) : null;
  const isRoot = Boolean(node && screen && node.id === screen.root.id);
  const parent = screen && node && !isRoot ? parentOf(screen.root, node.id) : null;
  const siblings = parent?.children ?? [];
  const at = node ? siblings.findIndex((c) => c.id === node.id) : -1;
  const def = node ? host.registry.get(node.component) : undefined;

  // A new selection closes the menu.
  useEffect(() => setMenu(null), [selected?.nodeId]);

  // Follow the component every frame (it scrolls, springs and navigates), in the slot's pixels.
  useEffect(() => {
    if (!selected) return;
    let raf = 0;
    const tick = () => {
      const el = bar.current;
      const slot = slotRef.current;
      const target = phoneRef.current ? findVisible(phoneRef.current, selected.nodeId) : null;
      if (el && slot) {
        if (!target) el.style.opacity = "0";
        else {
          const a = slot.getBoundingClientRect();
          const b = target.getBoundingClientRect();
          const room = b.top - a.top;
          const flip = room < el.offsetHeight + GAP + 4;
          const x = Math.max(0, Math.min(b.left - a.left - 2, a.width - el.offsetWidth));
          const y = flip ? b.bottom - a.top + GAP : b.top - a.top - el.offsetHeight - GAP;
          el.style.opacity = "1";
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          // The menu opens upward when the bar sits in the lower half of the phone.
          const up = y > a.height / 2;
          if (flip !== place.below || up !== place.up) setPlace({ below: flip, up });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selected, phoneRef, slotRef, place]);

  if (!selected || !node || !def || !screen) return null;
  const name = isRoot ? "Screen" : def.name;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div ref={bar} className="spp-selbar" data-below={place.below || undefined} data-up={place.up || undefined} style={{ opacity: 0 }} onPointerDown={stop} onClick={stop} role="toolbar" aria-label={`${name} layout`}>
      {isRoot ? (
        <span className="spp-selbar-name"><KindIcon id={def.id} symbol={def.icon} size={12} />{name}</span>
      ) : (
        // The name is the grip: drag it (or the component itself) to move it among its siblings.
        <span
          className="spp-selbar-name is-grip"
          title="Drag to move"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (phoneRef.current && slotRef.current) startLayoutDrag({ store, registry: host.registry, phone: phoneRef.current, slot: slotRef.current, nodeId: node.id, event: e.nativeEvent });
          }}
        >
          <span className="spp-selbar-grip"><UI name="grip" size={12} /></span>
          <KindIcon id={def.id} symbol={def.icon} size={12} />
          {name}
        </span>
      )}
      {!isRoot ? (
        <>
          <span className="spp-selbar-sep" />
          <Tool icon="up" label="Move up" kbd="⌥↑" disabled={at <= 0} onClick={() => slideInto(phoneRef.current, siblings.map((c) => c.id), () => store.moveNode(node.id, -1))} />
          <Tool icon="down" label="Move down" kbd="⌥↓" disabled={at < 0 || at >= siblings.length - 1} onClick={() => slideInto(phoneRef.current, siblings.map((c) => c.id), () => store.moveNode(node.id, 1))} />
          <span className="spp-selbar-sep" />
          <button type="button" className="spp-selbar-text" aria-expanded={menu?.mode === "swap"} onClick={() => setMenu(menu?.mode === "swap" ? null : { mode: "swap" })}>Swap</button>
          <Tool icon="copy" label="Duplicate" kbd="⌘D" onClick={() => store.duplicateNode(node.id)} />
          <Tool icon="trash" label="Delete" kbd="⌫" danger onClick={() => store.removeNode(node.id)} />
        </>
      ) : null}
      <span className="spp-selbar-sep" />
      <Tool icon="plus" label={isRoot ? "Add to the screen" : `Add after ${name}`} pressed={menu?.mode === "add"} onClick={() => setMenu(menu?.mode === "add" ? null : { mode: "add" })} />
      {menu ? (
        <PieceMenu
          project={project!}
          current={menu.mode === "swap" ? node : null}
          title={menu.mode === "swap" ? `Swap ${name} for` : isRoot ? "Add to the screen" : `Add after ${name}`}
          accepts={menu.mode === "swap" || !isRoot ? (parent ? host.registry.get(parent.component)?.container?.accepts : undefined) : def.container?.accepts}
          onPick={(id) => {
            if (menu.mode === "swap") store.swapComponent(node.id, id);
            else if (isRoot) store.insertComponent(node.id, id);
            else store.insertComponent(parent!.id, id, at + 1);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
});

function Tool({ icon, label, kbd, onClick, disabled, danger, pressed }: { icon: "up" | "down" | "copy" | "trash" | "plus"; label: string; kbd?: string; onClick: () => void; disabled?: boolean; danger?: boolean; pressed?: boolean }) {
  return (
    <button type="button" className={`spp-selbar-btn${danger ? " is-danger" : ""}`} aria-label={label} aria-pressed={pressed} title={kbd ? `${label} (${kbd})` : label} disabled={disabled} onClick={onClick}>
      <UI name={icon} size={14} />
    </button>
  );
}

/**
 * Pick a component: this app's own first (the pieces its screens are built from, most used first),
 * then the basics. Typing searches everything the library lists.
 */
function PieceMenu({ project, current, title, accepts, onPick, onClose }: { project: Project; current: ScreenNode | null; title: string; accepts?: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const { host } = usePlayground();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const allowed = (d: SwiftPieceDefinition | undefined): d is SwiftPieceDefinition =>
    Boolean(d && !d.hidden && d.id !== current?.component && (!accepts?.length || accepts.includes(d.id)));

  const sections = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query) {
      const hits = host.registry.listed().filter((d) => allowed(d) && (d.name.toLowerCase().includes(query) || d.id.includes(query)));
      hits.sort((a, b) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)));
      return [{ label: "Results", items: hits.slice(0, 24) }];
    }
    const used = new Map<string, number>();
    const walk = (n: ScreenNode) => {
      if (n.component !== "screen") used.set(n.component, (used.get(n.component) ?? 0) + 1);
      n.children?.forEach(walk);
    };
    project.screens.forEach((s) => walk(s.root));
    const layoutIds = new Set(["vstack", "hstack", "spacer", "divider"]);
    const own = [...used.entries()].filter(([id]) => !layoutIds.has(id)).sort((a, b) => b[1] - a[1]).map(([id]) => host.registry.get(id)).filter(allowed).slice(0, 10);
    const ownIds = new Set(own.map((d) => d.id));
    const basics = BASICS.filter((id) => !ownIds.has(id)).map((id) => host.registry.get(id)).filter(allowed);
    return [
      { label: "From this app", items: own },
      { label: "Basics", items: basics },
    ].filter((s) => s.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, project, host.registry, current, accepts]);

  const flat = sections.flatMap((s) => s.items);
  const pick = (d: SwiftPieceDefinition | undefined) => d && onPick(d.id);

  return (
    <div className="spp-piecemenu" role="dialog" aria-label={title}>
      <p className="spp-piecemenu-title">{title}</p>
      <label className="spp-piecemenu-search">
        <UI name="search" size={13} />
        <input
          ref={input}
          value={q}
          placeholder="Search components"
          onChange={(e) => (setQ(e.target.value), setActive(0))}
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.stopPropagation(), onClose());
            else if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => Math.min(i + 1, flat.length - 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(i - 1, 0)));
            else if (e.key === "Enter") (e.preventDefault(), pick(flat[active]));
          }}
        />
      </label>
      <div className="spp-piecemenu-list">
        {sections.map((s) => (
          <div key={s.label} className="spp-piecemenu-group">
            <p className="spp-piecemenu-label">{s.label}</p>
            {s.items.map((d) => {
              const i = flat.indexOf(d);
              const locked = !host.registry.usable(d, host.limits);
              return (
                <button key={d.id} type="button" className="spp-piecemenu-item" data-active={i === active || undefined} onMouseEnter={() => setActive(i)} onClick={() => pick(d)}>
                  <KindIcon id={d.id} symbol={d.icon} size={14} />
                  <span>{d.name}</span>
                  {locked ? <span className="spp-pro-tag">Pro</span> : null}
                </button>
              );
            })}
          </div>
        ))}
        {!flat.length ? <p className="spp-piecemenu-empty">Nothing fits here by that name.</p> : null}
      </div>
    </div>
  );
}
