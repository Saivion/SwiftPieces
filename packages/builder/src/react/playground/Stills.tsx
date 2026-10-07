"use client";
// Every screen of a project as a still phone, with its name: what a saved remix looks like, outside
// the Playground (an account's saved list, say). The same rendering as the Build sheet's artwork,
// with nothing interactive: no store, no navigation, taps do nothing.
import { memo, useMemo } from "react";
import { resolveTheme } from "../../core/looks.js";
import type { ComponentRegistry } from "../../core/registry.js";
import type { Project } from "../../core/schema.js";
import { NodeBoundary } from "../preview/NodeView.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars, type Scheme } from "../preview/env.js";
import { RuntimeContext, createChoiceBus, type Runtime } from "../preview/runtime.js";
import { PHONE_H, PHONE_W, screenTitle } from "../preview/phone.js";
import { useStyleFonts } from "./style-fonts.js";

/**
 * `project` must already be validated (validateProject) against `registry`. `width` is each phone's
 * width in CSS pixels; `scheme` is the preview's light or dark when the project doesn't fix one.
 */
export const ProjectStills = memo(function ProjectStills({ project, registry, width = 112, scheme = "dark" }: { project: Project; registry: ComponentRegistry; width?: number; scheme?: Scheme }) {
  const resolved = useMemo(() => (project.theme ? resolveTheme(project.theme) : null), [project.theme]);
  useStyleFonts(resolved);
  const runtime = useMemo<Runtime>(() => ({ registry, act: () => false, haptic: () => {}, scale: () => 1, onError: () => {}, overlay: () => null, choices: createChoiceBus(), still: true }), [registry]);
  const k = width / PHONE_W;
  return (
    <ul className="spp-stills" aria-label={`${project.screens.length} screen${project.screens.length === 1 ? "" : "s"}`}>
      {project.screens.map((screen) => {
        const s = schemeFor(String(screen.root.props.appearance ?? "system"), resolved, scheme);
        return (
          <li key={screen.id} className="spp-still">
            <div className="spp-still-phone" style={{ width, height: PHONE_H * k, borderRadius: 16 * (width / 112) }}>
              <div className="spb-phone spp-thumb-phone" data-scheme={s} style={{ ...themeVars(resolved, s), transform: `scale(${k})` }} inert>
                <RuntimeContext.Provider value={runtime}>
                  <ThemeContext.Provider value={resolved}>
                    <SchemeContext.Provider value={s}>
                      <div className="spp-screen spb-phone-screen" data-role="top" data-scheme={s} style={themeVars(resolved, s)}>
                        <div className="spb-screen-host">
                          <NodeBoundary node={screen.root} />
                        </div>
                      </div>
                    </SchemeContext.Provider>
                  </ThemeContext.Provider>
                </RuntimeContext.Provider>
              </div>
            </div>
            <span className="spp-still-name">{screenTitle(screen)}</span>
          </li>
        );
      })}
    </ul>
  );
});
