import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button } from "@/components/ui/button";
import { band, sectionBody, sectionTitle } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

export const tinyPersonas = "https://tinypersonas.com";

/** Logos from TinyPersonas (public/app-icons/*.webp, 256px, transparent corners). */
const icons = ["scales", "moon", "donut", "umbrella", "grapefruit", "camera", "ripple", "tiles"];

function Out() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 11l6-6M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Icon({ id, className }: { id: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/app-icons/${id}.webp`} alt="" loading="lazy" className={cn("aspect-square rounded-[22.5%] object-cover shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_20px_-8px_rgb(0_0_0/0.25)]", className)} />
  );
}

const cta = (
  <Button href={tinyPersonas}>
    Visit TinyPersonas <Out />
  </Button>
);

/** A centred band over a level row of same-size icons that rise from the tray's bottom edge (Saivion picked B, "Icon wall", 2026-11-15). */
function IconWall() {
  return (
    <Reveal className="tray overflow-hidden">
      <div className="px-6 pt-10 text-center sm:pt-14">
        <h2 className={cn(sectionTitle, "mx-auto max-w-[920px]")}>
          Need an app icon? <span className="text-muted">Give your app a face of its own.</span>
        </h2>
        <p className={cn(sectionBody, "mx-auto mt-3 max-w-[46ch]")}>TinyPersonas makes one-off logos for single apps, not icon packs. Pick one and it is yours.</p>
        <div className="mt-7 flex justify-center">{cta}</div>
      </div>
      <div className="mt-10 flex items-end justify-center gap-3 pb-0 sm:gap-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        {icons.map((id) => (
          <div key={id} className="shrink-0" style={{ transform: "translateY(12px)" }}>
            <Icon id={id} className="w-[64px] sm:w-[84px]" />
          </div>
        ))}
      </div>
    </Reveal>
  );
}

/** "Need an app icon?": the hand-off to TinyPersonas on the landing page. */
export function AppIconPromo() {
  return (
    <Container className={band}>
      <section aria-label="App icons from TinyPersonas">
        <IconWall />
      </section>
    </Container>
  );
}
