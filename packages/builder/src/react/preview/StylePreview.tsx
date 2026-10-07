"use client";
// A style on its own, outside the Playground: a few components, or a whole screen in an iPhone,
// drawn by the same renderers in the same theme, light or dark. It's live: toggles flip, segments
// slide, fields take typing, buttons press. Links go nowhere, so nothing navigates. The host's
// Styles page (swiftpieces.com/styles) shows a style taking shape with these.
import { memo, useMemo, useRef, type CSSProperties } from "react";
import { resolveTheme } from "../../core/looks.js";
import type { ComponentRegistry } from "../../core/registry.js";
import type { ScreenNode, Theme } from "../../core/schema.js";
import { useStyleFonts } from "../playground/style-fonts.js";
import { NodeBoundary } from "./NodeView.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars, type Scheme } from "./env.js";
import { BEZEL, PHONE_H, PHONE_W, StatusBar } from "./phone.js";
import { RuntimeContext, createChoiceBus, type Runtime } from "./runtime.js";

export type StylePreviewProps = {
  /** The style. Null draws plain iOS. */
  theme: Theme | null;
  /** Light or dark, when the style (or the node's own `appearance`) doesn't fix one. */
  scheme: Scheme;
  /** The registry the node's components come from (createRegistry(freeDefinitions), say). */
  registry: ComponentRegistry;
  /**
   * What to draw, with every id set (a built project's nodes, or `cloneWithNewIds`): a `screen` root
   * for `phone`, any node (a column of components, usually) for `fragment`.
   */
  node: ScreenNode;
  /**
   * `phone`: a whole screen in an iPhone, `width` CSS pixels wide, its status bar and home bar
   * included. `fragment` (default): just the components on the style's ground, as wide as their
   * box and as tall as they are, laid out in points at 1:1.
   */
  frame?: "phone" | "fragment";
  /** The phone's width in CSS pixels. */
  width?: number;
  /** A fragment's padding, in points. */
  padding?: number;
  /**
   * A fragment without its own ground: the components on whatever is behind them (a host surface
   * already wearing the style's ground and backdrop through `themeVars`), so a scaled fragment
   * never shows its ground as a smaller patch.
   */
  bare?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * One style preview. Each mounts its own runtime: its controls' state and its overlay layer (where
 * a menu or a toast opens) are its own. Fonts the style needs load once, as in the Playground.
 */
export const StylePreview = memo(function StylePreview({ theme, scheme, registry, node, frame = "fragment", width = 280, padding = 16, bare = false, className, style }: StylePreviewProps) {
  const resolved = useMemo(() => (theme ? resolveTheme(theme) : null), [theme]);
  useStyleFonts(resolved);
  const overlay = useRef<HTMLDivElement>(null);
  const k = width / (PHONE_W + BEZEL * 2);
  const scaleRef = useRef(1);
  scaleRef.current = frame === "phone" ? k : 1;
  const runtime = useMemo<Runtime>(
    () => ({ registry, act: () => false, haptic: () => {}, scale: () => scaleRef.current, onError: () => {}, overlay: () => overlay.current, choices: createChoiceBus() }),
    [registry],
  );
  const s = schemeFor(String(node.props.appearance ?? "system"), resolved, scheme);
  const vars = themeVars(resolved, s);
  const content = (
    <RuntimeContext.Provider value={runtime}>
      <ThemeContext.Provider value={resolved}>
        <SchemeContext.Provider value={s}>
          <div className="spp-screen spb-phone-screen" data-role={frame === "phone" ? "top" : undefined} data-scheme={s} style={vars}>
            <div className="spb-screen-host">
              <NodeBoundary node={node} />
            </div>
          </div>
        </SchemeContext.Provider>
      </ThemeContext.Provider>
    </RuntimeContext.Provider>
  );

  if (frame === "fragment") {
    return (
      <div className={`spb-phone spb-style-fragment${className ? ` ${className}` : ""}`} data-scheme={s} data-bare={bare || undefined} style={{ ...vars, ["--spb-fragment-pad" as string]: `${padding}px`, ...style }}>
        {content}
        <div ref={overlay} className="spp-overlay" />
      </div>
    );
  }

  return (
    <div className={`spb-style-phone${className ? ` ${className}` : ""}`} style={{ width, height: (PHONE_H + BEZEL * 2) * k, ...style }}>
      <div className="spp-device" style={{ transform: `scale(${k})` }}>
        <div className="spb-phone" data-scheme={s} style={vars}>
          {content}
          <div ref={overlay} className="spp-overlay" />
          <StatusBar />
          <span className="spb-home" aria-hidden />
        </div>
      </div>
    </div>
  );
});
