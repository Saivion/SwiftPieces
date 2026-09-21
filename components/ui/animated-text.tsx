import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Word-by-word masked reveal for display headings, in CSS and on the server.
 *
 * This was a Motion client component, which meant every word of the h1 shipped as
 * `style="opacity:0;transform:translateY(110%)"` and the headline could not paint until the
 * bundle had hydrated. It now renders as plain server markup with a CSS animation, so the
 * heading is in the document at full opacity and the rise plays from first paint.
 *
 * The animation is transform only. Each word rises out of its own clipping box, exactly as
 * before; the opacity fade is gone because it was invisible underneath the mask and an element
 * at opacity 0 cannot be a Largest Contentful Paint candidate.
 */
export function AnimatedText({
  text,
  accent,
  className,
  as: Tag = "h1",
  delay = 0,
  stagger = 0.04,
  duration = 0.55,
}: {
  text: string;
  accent?: string;
  className?: string;
  as?: "h1" | "h2" | "p";
  delay?: number;
  stagger?: number;
  duration?: number;
}) {
  const words = text.split(" ");
  return (
    <Tag className={cn("text-balance", className)} aria-label={text}>
      {words.map((w, i) => {
        const isAccent = accent && w.replace(/[.,!?]/g, "") === accent;
        return (
          // The separating space is a sibling of the mask, not content inside it. A trailing space
          // inside an inline-block is trimmed, which ran every word of the headline together.
          <Fragment key={i}>
            <span className="sp-word-mask">
              <span
                className={cn("sp-word", isAccent && "text-accent")}
                style={{ "--sp-delay": `${delay + i * stagger}s`, "--sp-dur": `${duration}s` } as CSSProperties}
              >
                {w}
              </span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </Tag>
  );
}
