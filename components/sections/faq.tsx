"use client";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/effects/reveal";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export const faqs = [
  { q: "What is a piece, exactly?", a: "One self-contained .swift file named after its primary type, plus a .metal file when a shader is involved. Public struct, init parameters with defaults, a #Preview, Apple frameworks only." },
  { q: "Do I need iOS 26?", a: "No. The baseline is iOS 17. Liquid Glass pieces use glass on iOS 26 and gate it with #available, falling back to a Material below. MeshGradient pieces need iOS 18." },
  { q: "How does the CLI add files without editing my project?", a: "Xcode 16 treats folders as file-system synchronized groups. The CLI writes into a SwiftPieces folder inside your app's group, so the files appear in the target automatically. Legacy projects add the folder once by hand." },
  { q: "Can my AI agent use this?", a: "Yes. The registry is public JSON, llms.txt describes every piece, and the MCP server lets Claude Code, Cursor and Xcode search and install in plain English. Pro tools require a license key." },
  { q: "What does the free license allow?", a: "MIT + Commons Clause. Use the pieces in any personal or commercial app. Do not sell, sublicense or redistribute the pieces themselves, alone, bundled or ported." },
  { q: "Is Pro a subscription?", a: "No. Swift Pieces Pro is one plan with lifetime access to the complete library, including everything added later, across unlimited projects. See the plan and pricing on pro.swiftpieces.com." },
];

export type FaqItem = { q: string; a: string };

export function FAQ({ items = faqs, title = "Questions, answered.", label = "FAQ" }: { items?: FaqItem[]; title?: string; label?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <SectionHeader label={label} title={title} className="lg:sticky lg:top-28" />
          <Reveal><Panel className="px-6 md:px-8">
            {items.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className="border-b border-[var(--card-border)] last:border-b-0">
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                    <span className="p-item text-[17px]">{f.q}</span>
                    <span className={cn("relative size-5 shrink-0 transition-transform duration-300", isOpen && "rotate-45")} aria-hidden>
                      <span className="absolute top-1/2 left-0 h-px w-5 -translate-y-1/2 bg-foreground" />
                      <span className="absolute top-0 left-1/2 h-5 w-px -translate-x-1/2 bg-foreground" />
                    </span>
                  </button>
                  <div className={cn("grid transition-[grid-template-rows] duration-400 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden"><p className="p-body pb-6 pr-10">{f.a}</p></div>
                  </div>
                </div>
              );
            })}
          </Panel></Reveal>
        </div>
      </Container>
    </section>
  );
}
