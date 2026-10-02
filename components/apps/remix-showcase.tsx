import type { ReactNode } from "react";
import { Arrow } from "@/components/ui/button";
import { apps, cdn, isProApp, screenPath } from "@/lib/apps";
import { showcase } from "@/lib/apps/showcase";
import { pro } from "@/lib/site";
import { PlanChip } from "./pro-chip";
import { ProUnlock } from "./pro-unlock";
import { RemixHeader, type HeaderPair } from "./remix-header";

/**
 * The App Library header (remix-header.tsx lays it out): the page's copy, then the showcase apps as a
 * picker beside an App Store screenshot and the screen we remixed from it (the developer's labeled
 * as such, ours as ours; a Pro app's screen blurred), then the way into the Pro apps, which fills
 * with the Pro halftone on hover (pro-unlock.tsx).
 */
export function RemixShowcase({ intro }: { intro: ReactNode }) {
  const pairs: HeaderPair[] = showcase.map((p) => {
    const shot = p.app.store.screenshots[p.shot];
    return {
      slug: p.app.slug,
      name: p.app.name,
      icon: cdn(p.app.store.icon, 60),
      category: p.app.store.category,
      store: { src: cdn(shot.url, 560), width: shot.width, height: shot.height, developer: p.app.store.developer },
      remix: { src: p.still, title: p.title, href: screenPath(p.app, p.step), pro: p.pro },
    };
  });
  const proApps = apps.filter(isProApp);
  const proScreens = proApps.reduce((n, a) => n + (a.pattern.steps?.length ?? 0), 0);
  return (
    <RemixHeader
      pairs={pairs}
      intro={intro}
      pro={
        <ProUnlock href={pro.pricing}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              <PlanChip pro />
              Unlock all {apps.length} apps and every future app
            </span>
            <span className="mt-1 block max-w-[27rem] text-[12.5px] leading-relaxed text-muted">
              {proApps.length} more apps and {proScreens} screens to use, take apart and remix in SwiftUI, with AI remix and your remixes saved to your account.
            </span>
          </span>
          <Arrow motion className="flex-none text-foreground" />
        </ProUnlock>
      }
    />
  );
}
