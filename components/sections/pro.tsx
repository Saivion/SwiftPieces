import { Container } from "@/components/ui/container";
import { SectionHead, band } from "@/components/sections/feature-row";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { Index } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/button";
import { pro } from "@/lib/site";
import { buildKitLine, namesWithMore, proCatalog, remixingLine } from "@/lib/pro-catalog";

// Marketing list. Pro items never come from a registry file in Free (Rev 3 §3.2); counts live in lib/pro-catalog.ts.
export const proSections = [
  { n: "01", title: `${proCatalog.screens} screens`, body: `${namesWithMore(proCatalog.screenExamples)}. Production-ready screens you adapt, not rebuild.`, href: pro.screens },
  { n: "02", title: `${proCatalog.flows.total} flows`, body: `Whole journeys through every template, from first run through sign in and the paywall to the core of the app and its settings, screen by screen.`, href: pro.flows },
  { n: "03", title: `${proCatalog.templates} app templates`, body: `Complete Xcode projects: ${namesWithMore(proCatalog.templateNames, 5)} apps. Download one, rename it and ship.`, href: pro.templates },
  { n: "04", title: "The Build Kit", body: `${buildKitLine}.`, href: pro.kit },
  { n: "05", title: "Pro remixing", body: `${remixingLine}.`, href: "/apps", where: "In the Playground" },
];

/**
 * Pro's five parts as tiles under a Graphite head row: the index, the title with its arrow, one line,
 * and where it lives. Each tile is a link that lifts to the raised surface on hover.
 */
export function ProSection({ heading = true }: { heading?: boolean }) {
  return (
    <section className={band} id="pro">
      <Container>
        {heading ? <SectionHead tags={[{ label: "SwiftPieces Pro", icon: null }]} title="Then the whole app." action={{ label: "Explore Pro", href: pro.library }} /> : null}
        <RevealGroup className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" stagger={0.1}>
          {proSections.map((c) => (
            <RevealItem key={c.n} className="h-full">
              <a href={c.href} className="group flex h-full flex-col rounded-[22px] bg-surface px-6 pt-[26px] pb-6 transition-colors duration-200 hover:bg-surface-3">
                <Index n={c.n} />
                <p className="mt-10 inline-flex items-center gap-2 text-[19px] font-medium tracking-[-0.02em]">{c.title}<Arrow className="size-3.5 text-subtle transition-colors group-hover:text-foreground" /></p>
                <p className="mt-2.5 max-w-md text-[14.5px] leading-[23px] text-pretty text-muted">{c.body}</p>
                <p className="mt-auto pt-6 text-[12.5px] text-subtle">{"where" in c ? c.where : "On pro.swiftpieces.com"}</p>
              </a>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
