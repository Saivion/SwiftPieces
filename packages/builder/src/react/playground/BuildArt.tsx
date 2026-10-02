"use client";
// The Build sheet's picture: the app you're about to take, not decoration. Up to three of the
// project's own screens (the one showing in front), drawn live by the phone's renderers in the
// app's style, side by side on a dark stage over the host's backdrop (the sites pass their animated halftone). A host passes it as `art`.
import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { resolveTheme } from "../../core/looks.js";
import type { Screen } from "../../core/schema.js";
import { NodeBoundary } from "../preview/NodeView.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars } from "../preview/env.js";
import { RuntimeContext, createChoiceBus, type Runtime } from "../preview/runtime.js";
import { usePlayground } from "./context.js";
import { PHONE_H, PHONE_W } from "./Device.js";
import { currentScreenId, usePlay } from "./store.js";

/** How wide each phone is drawn, in CSS pixels, before the fan is fitted to the stage. */
const W = 148;
/** The largest the fan may grow past its drawn size when the stage has room. */
const MAX_FIT = 1.25;

/**
 * Scales the fan so every phone, tilt and edge ring included, sits inside the stage: the phones'
 * outer bounds are measured (unscaled) and fitted to the fan's box. Re-fits on resize and after a
 * phone changes side.
 */
function useFit(screens: number) {
  const fan = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fan.current;
    if (!el) return;
    const RING = 8; // the phones' edge rings and a hair of air
    const fit = () => {
      const now = Number(el.style.getPropertyValue("--fit")) || 1;
      const phones = [...el.querySelectorAll<HTMLElement>(".spp-buildart-phone")].filter((p) => p.offsetParent !== null);
      if (!phones.length) return;
      const box = el.getBoundingClientRect();
      const rects = phones.map((p) => p.getBoundingClientRect());
      const w = (Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))) / now + RING * 2;
      const h = (Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))) / now + RING * 2;
      const next = Math.min(MAX_FIT, (box.width / now) / w, (box.height / now) / h);
      if (Number.isFinite(next) && next > 0) el.style.setProperty("--fit", next.toFixed(4));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    el.addEventListener("transitionend", fit);
    return () => {
      ro.disconnect();
      el.removeEventListener("transitionend", fit);
    };
  }, [screens]);
  return fan;
}

export const BuildArt = memo(function BuildArt({ backdrop }: { backdrop?: ReactNode }) {
  const { store, host } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const previewScheme = usePlay(store, (s) => s.scheme);
  const resolved = useMemo(() => (project?.theme ? resolveTheme(project.theme) : null), [project?.theme]);
  const fan = useFit(project?.screens.length ?? 0);
  const runtime = useMemo<Runtime>(() => ({ registry: host.registry, act: () => false, haptic: () => {}, scale: () => 1, onError: () => {}, overlay: () => null, choices: createChoiceBus(), still: true }), [host.registry]);
  const back = backdrop ? <div className="spp-buildart-backdrop">{backdrop}</div> : null;
  if (!project) return <div className="spp-buildart">{back}</div>;

  // The screen showing in the middle, its neighbours either side.
  const at = Math.max(0, project.screens.findIndex((s) => s.id === current));
  const pick = [project.screens[at - 1] ?? project.screens[at + 2], project.screens[at], project.screens[at + 1] ?? project.screens[at - 2]].filter((s, i, all): s is Screen => Boolean(s) && all.indexOf(s) === i);
  const middle = pick.indexOf(project.screens[at]);
  const k = W / PHONE_W;

  return (
    <div className="spp-buildart">
      {back}
      <div className="spp-buildart-fan" ref={fan}>
        {pick.map((screen, i) => {
          const scheme = schemeFor(String(screen.root.props.appearance ?? "system"), resolved, previewScheme);
          const side = i - middle;
          return (
            <div key={screen.id} className="spp-buildart-phone" data-side={side < 0 ? "left" : side > 0 ? "right" : "center"} style={{ width: W, height: PHONE_H * k }}>
              <div className="spb-phone spp-thumb-phone" data-scheme={scheme} style={{ ...themeVars(resolved, scheme), transform: `scale(${k})` }} inert>
                <RuntimeContext.Provider value={runtime}>
                  <ThemeContext.Provider value={resolved}>
                    <SchemeContext.Provider value={scheme}>
                      <div className="spp-screen spb-phone-screen" data-role="top" data-scheme={scheme} style={themeVars(resolved, scheme)}>
                        <div className="spb-screen-host">
                          <NodeBoundary node={screen.root} />
                        </div>
                      </div>
                    </SchemeContext.Provider>
                  </ThemeContext.Provider>
                </RuntimeContext.Provider>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
