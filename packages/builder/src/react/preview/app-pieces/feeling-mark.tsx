"use client";
// Feeling Mark (definitions/app-pieces/feeling-mark.ts): the feeling's shape in its corner's colour.
// It settles in from 0.95 with a fade; a tap wobbles it on a spring with a light tap, as the Swift's
// keyframes do. Reduce Motion keeps it still.
import { useRef, useState } from "react";
import { FEELING_MARKS } from "../../../definitions/app-pieces/artwork.js";
import { feelingMarkColor } from "../../../definitions/app-pieces/feeling-mark.js";
import { n, s, type Renderer } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { ArtworkSvg } from "./artwork.js";
import { Root, enter, useHaptic } from "./wellbeing-shared.js";

injectStyle(
  "spa-feeling-mark-css",
  `@keyframes spfm-wobble{0%{transform:rotate(0)}22%{transform:rotate(16deg)}50%{transform:rotate(-9deg)}76%{transform:rotate(3deg)}100%{transform:rotate(0)}}
.spfm-wobble{animation:spfm-wobble .56s cubic-bezier(.22,1,.36,1)}`,
);

export const FeelingMark: Renderer = (r) => {
  const feeling = (FEELING_MARKS as readonly string[]).includes(s(r.p, "feeling")) ? s(r.p, "feeling") : "sun";
  const size = n(r.p, "size") || 56;
  const color = feelingMarkColor(r.p);
  const haptic = useHaptic();
  const [taps, setTaps] = useState(0);
  const el = useRef<HTMLSpanElement>(null);
  return (
    <Root r={r} style={{ flex: "none", width: size, height: size }}>
      <span
        ref={el}
        role="img"
        aria-hidden
        onClick={(e) => {
          haptic("light", e.currentTarget);
          if (!reducedMotion()) setTaps((t) => t + 1);
        }}
        data-spw-anim="pop"
        style={{ ...enter("pop").style, display: "block", width: size, height: size, cursor: "pointer" }}
      >
        <span key={taps} className={taps ? "spfm-wobble" : undefined} style={{ display: "block", width: "100%", height: "100%" }}>
          <ArtworkSvg id={feeling} ink={color} />
        </span>
      </span>
    </Root>
  );
};
