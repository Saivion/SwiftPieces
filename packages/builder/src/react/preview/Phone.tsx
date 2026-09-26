"use client";
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { useBuilder } from "../context.js";
import { record } from "../perf.js";
import { useStore } from "../store.js";
import { SchemeContext } from "./env.js";
import { NodeBoundary } from "./NodeView.js";

const W = 390;
const H = 844;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The iPhone stage. The phone is laid out at its real size in points and scaled with one CSS
 * transform, so resizing the window never re-renders a single node.
 */
export function Phone() {
  const { store } = useBuilder();
  const root = useStore(store, (s) => (s.project.screens.find((x) => x.id === s.screenId) ?? s.project.screens[0]).root);
  const previewScheme = useStore(store, (s) => s.scheme);
  const stage = useRef<HTMLDivElement>(null);
  const appearance = String(root.props.appearance ?? "system");
  const scheme = appearance === "dark" || appearance === "light" ? appearance : previewScheme;

  useIsoLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const pad = el.clientWidth < 520 ? 32 : 64;
      const scale = Math.min((el.clientHeight - pad) / H, (el.clientWidth - pad) / W, 1);
      el.style.setProperty("--spb-scale", String(Math.max(0.3, scale)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onClick = (e: MouseEvent) => {
    const t0 = performance.now();
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]");
    if (!target) return;
    const id = target.dataset.nodeId!;
    store.select(id === root.id ? null : id);
    requestAnimationFrame(() => record("select", performance.now() - t0));
  };

  return (
    <div className="spb-stage" ref={stage}>
      <div className="spb-phone-fit">
        <div className="spb-phone" data-scheme={scheme} onClick={onClick} aria-hidden>
          <div className="spb-statusbar" aria-hidden>
            <span>9:41</span>
            <span className="spb-island" />
            <span className="spb-status-icons">
              <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor" /><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
              <svg viewBox="0 0 26 12" width="26" height="12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" /><rect x="23.5" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".4" /></svg>
            </span>
          </div>
          <SchemeContext.Provider value={scheme}>
            <div className="spb-screen-host">
              <NodeBoundary node={root} />
            </div>
          </SchemeContext.Provider>
          <span className="spb-home" aria-hidden />
        </div>
      </div>
    </div>
  );
}
