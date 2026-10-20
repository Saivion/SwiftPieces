import { Fragment, type CSSProperties } from "react";
import { showcase, type ShowcasePair } from "@/lib/apps/showcase";
import { cn } from "@/lib/cn";

type Token = { word: string; accent?: boolean } | { phone: number };

/**
 * "Apps [ ] you love, [ ] remixed / screen by [ ] screen in SwiftUI.": a sentence rather than a count, so it
 * never goes stale as apps are added, the last word in the accent, as the landing ends on "feature.".
 */
const lines: Token[][] = [
  [{ word: "Apps" }, { phone: 0 }, { word: "you" }, { word: "love," }, { phone: 1 }, { word: "remixed" }],
  [{ word: "screen" }, { word: "by" }, { phone: 2 }, { word: "screen" }, { word: "in" }, { word: "SwiftUI.", accent: true }],
];

/**
 * The Playground headline: two lines with a whole iPhone set into the words, each showing a screen we
 * remixed from one of the free picks (lib/apps/showcase.ts). The type is the landing's headline
 * (components/sections/hero.tsx): the same size, weight, tracking and width, its words rising one by one
 * the same way. Only the leading differs, 1.45 against the landing's 1, so each 1.4em phone stays inside
 * its own line: centred on the letters' middle, with negative block margins so it never stretches the
 * line, it clears the words and the phones of the line above and below wherever it lands. It is always
 * two lines: at every width the type is sized to the column (the widest line is about 12.4em), at most
 * the landing's size there, rather than wrapping.
 *
 * The phones rise a beat behind the words, and both stop under Reduce Motion. They are decorative: the
 * heading reads as plain words.
 */
export function RemixHeadline({ className }: { className?: string }) {
  let i = 0;
  return (
    <div className={cn("@container w-full", className)}>
      <h1 className="mx-auto max-w-[980px] text-[length:min(44px,100cqi/12.6)] leading-[1.45] font-normal tracking-[-0.04em] sm:text-[length:min(62px,100cqi/12.6)] lg:text-[length:min(80px,100cqi/12.6)] lg:tracking-[-0.05em]">
        {lines.map((line, l) => (
          <span key={l} className="block whitespace-nowrap">
            {line.map((t, k) => (
              // The space is a sibling of the mask, not inside it, where an inline-block would trim it. The
              // first line ends on one too, so the heading's text reads "remixed screen", not "remixedscreen".
              <Fragment key={k}>
                {"phone" in t ? <Phone pick={showcase[t.phone]} index={t.phone} /> : <Word text={t.word} accent={t.accent} delay={i++ * 0.04} />}
                {k < line.length - 1 || l === 0 ? " " : null}
              </Fragment>
            ))}
          </span>
        ))}
      </h1>
    </div>
  );
}

/** A word rising out of its mask, as AnimatedText (components/ui/animated-text.tsx) sets the landing's. */
function Word({ text, accent, delay }: { text: string; accent?: boolean; delay: number }) {
  return (
    <span className="sp-word-mask">
      <span className={cn("sp-word", accent && "text-accent")} style={{ "--sp-delay": `${delay}s`, "--sp-dur": "0.55s" } as CSSProperties}>
        {text}
      </span>
    </span>
  );
}

/**
 * Each phone's tilt, in degrees, so the three sit like stickers rather than in a row. The first and third
 * sit nearly over each other across the two lines, so they lean the same way and their near corners part.
 */
const TILTS = [-3, 3, -2.5];

/**
 * An iPhone in the line, sized in em so it scales with the type: the landing's iPhone
 * (components/visual/iphone.tsx) drawn in em, the same titanium band and black bezel around the remix's
 * still, which carries its own status bar and Dynamic Island. Kept dark in both themes by .stage-dark.
 * The tilt sits on the outer box and the rise on the inner one, so the two transforms never fight.
 */
function Phone({ pick, index }: { pick?: ShowcasePair; index: number }) {
  if (!pick) return null;
  return (
    <span aria-hidden className="remix-phone mx-[0.02em] my-[-0.1em] inline-block w-[0.68em] align-middle" style={{ "--tilt": `${TILTS[index] ?? 0}deg` } as CSSProperties}>
      <span className="sp-enter block" style={{ "--sp-y": "0.4em", "--sp-delay": `${0.2 + index * 0.1}s`, "--sp-dur": "0.8s" } as CSSProperties}>
        <span className="stage-dark block rounded-[0.12em] bg-[#1b1b1d] p-[max(1px,0.01em)] shadow-[0_0.18em_0.34em_-0.16em_rgb(0_0_0/0.55),0_0.05em_0.12em_-0.05em_rgb(0_0_0/0.4),inset_0_0_0_max(1px,0.005em)_rgb(255_255_255/0.16)]">
          <span className="block rounded-[0.11em] bg-black p-[0.026em]">
            <img src={pick.still} alt="" width={480} height={1040} className="block aspect-[480/1040] w-full rounded-[0.085em]" />
          </span>
        </span>
      </span>
    </span>
  );
}
