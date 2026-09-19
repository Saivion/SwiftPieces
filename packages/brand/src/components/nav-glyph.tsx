import type { CSSProperties } from "react";

/**
 * Six-dot grid that sits left of plain nav links (never on dropdown triggers, which carry a chevron).
 * The dots ripple when the parent `.group/n` link is hovered; see `.nav-glyph` in theme.css.
 */
export function NavGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden className={["nav-glyph", className].filter(Boolean).join(" ")}>
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </span>
  );
}
