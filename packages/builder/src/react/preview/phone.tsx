"use client";
// The iPhone every preview is laid out in: its size in points, its bezel and its status bar. Kept
// apart from the Playground's Device so a still or a style preview can draw a phone without pulling
// in the store.
import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { Screen } from "../../core/schema.js";

export const PHONE_W = 390;
export const PHONE_H = 844;
/** Bezel around the screen, in points. */
export const BEZEL = 12;

export const screenTitle = (s: Screen) => String(s.root.props.title ?? "").trim() || s.tab?.title || s.name.replace(/View$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

export function StatusBar() {
  return (
    <div className="spb-statusbar" aria-hidden>
      <span>9:41</span>
      <span className="spb-island" />
      <span className="spb-status-icons">
        <Signal size={17} strokeWidth={2.4} />
        <Wifi size={17} strokeWidth={2.4} />
        <BatteryFull size={25} strokeWidth={1.8} />
      </span>
    </div>
  );
}
