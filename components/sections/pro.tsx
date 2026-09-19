import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { Panel, PanelBody, Index } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/button";
import { pro } from "@/lib/site";
import { buildKitLine, namesWithMore, proCatalog } from "@/lib/pro-catalog";

// Marketing list. Pro items never come from a registry file in Free (Rev 3 §3.2); counts live in lib/pro-catalog.ts.
export const proSections = [
  { n: "01", title: `${proCatalog.screens} screens`, body: `${namesWithMore(proCatalog.screenExamples)}. Production-ready screens you adapt, not rebuild.`, href: pro.screens },
  { n: "02", title: `${proCatalog.templates} app templates`, body: `Complete Xcode projects: ${namesWithMore(proCatalog.templateNames, 5)} apps. Download one, rename it and ship.`, href: pro.templates },
  { n: "03", title: "The Build Kit", body: `${buildKitLine}.`, href: pro.kit },
];

export function ProSection({ heading = true }: { heading?: boolean }) {
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28" id="pro">
      {heading ? (
        <Container>
          <SectionHeader label="Swift Pieces Pro" title="Then the whole app." action={{ label: "Explore Pro", href: pro.library }} />
        </Container>
      ) : null}
      <Container>
        <RevealGroup className={`grid gap-4 md:grid-cols-3 ${heading ? "mt-14" : ""}`} stagger={0.1}>
          {proSections.map((c) => (
            <RevealItem key={c.n} className="h-full">
              <a href={c.href} className="group block h-full">
                <Panel hover className="h-full">
                  <PanelBody className="p-7 lg:p-8">
                    <Index n={c.n} />
                    <p className="p-item mt-3 inline-flex items-center gap-2">{c.title}<Arrow className="size-3.5 text-subtle transition-colors group-hover:text-foreground" /></p>
                    <p className="p-body mt-2 max-w-md">{c.body}</p>
                    <p className="mt-auto pt-6 text-[12px] text-subtle">On pro.swiftpieces.com</p>
                  </PanelBody>
                </Panel>
              </a>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
