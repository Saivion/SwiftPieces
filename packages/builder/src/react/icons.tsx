// Simplified stand-ins for the SF Symbols in the palette. SF Symbols only ship on Apple platforms,
// so the web preview draws its own glyph per symbol name while the export writes the real name.
import type { CSSProperties, ReactNode } from "react";

const P: Record<string, ReactNode> = {
  "arrow.right": <path d="M4 12h15M13 6l6 6-6 6" />,
  "chevron.right": <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  checkmark: <path d="M5 12.5l4.5 4.5L19 7" />,
  xmark: <path d="M6 6l12 12M18 6L6 18" />,
  envelope: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3.5 7l8.5 6.5L20.5 7" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  person: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
  "person.crop.circle.fill": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity=".9" /><circle cx="12" cy="9.5" r="3.4" fill="var(--spb-glyph-knock, #000)" stroke="none" opacity=".45" /><path d="M5.8 18.5c1.3-2.6 3.5-3.9 6.2-3.9s4.9 1.3 6.2 3.9" stroke="var(--spb-glyph-knock, #000)" strokeOpacity=".45" strokeWidth="2.4" /></>,
  magnifyingglass: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  gearshape: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  house: <><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  sparkles: <><path d="M10 3l1.6 4.9L16.5 9.5l-4.9 1.6L10 16l-1.6-4.9L3.5 9.5l4.9-1.6z" /><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" /></>,
  bolt: <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.3 3.6-8 1 1.6 1.4 2.8 1.5 4 1.4-1.4 2.6-3.8 2.4-7.3 3.6 2.6 5.5 6.6 5.5 10.7 0 3.9-2.6 6.8-6.5 6.8z" />,
  leaf: <><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19l8-8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" /></>,
  camera: <><path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  photo: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></>,
  cart: <><path d="M3 4h2.5l2.2 11h10.3l2-8H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  creditcard: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 15h4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  bookmark: <path d="M7 3.5h10v17l-5-3.8-5 3.8z" />,
  paperplane: <><path d="M21 3L3 10.5l7 2.5 2.5 7z" /><path d="M10 13l11-10" /></>,
  tray: <><path d="M3.5 13.5L6 5h12l2.5 8.5V19h-17z" /><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5" /></>,
  "square.and.arrow.up": <><path d="M12 3.5v11M8 7.5l4-4 4 4" /><path d="M7 10.5H5.5v10h13v-10H17" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  "music.note": <><path d="M9.5 18V5.5l10-2V16" /><circle cx="7" cy="18" r="2.5" /><circle cx="17" cy="16" r="2.5" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2C11.5 19.5 4.5 12.5 4.5 5.5a2 2 0 0 1 2-2z" />,
  "bubble.left": <path d="M5 17.5l-1.5 3.5 4.5-2A9.5 8 0 1 0 5 17.5z" />,
  "chart.bar": <path d="M5 20V12M10 20V6M15 20v-9M20 20V4" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  "hand.wave": <><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M14 11V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.7 7-6.5 7-3 0-4.5-1.5-6-4L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14" /></>,
  apple: <path d="M16.4 12.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.8-1.2 1.2-2.4 1.2-2.5 0 0-2.4-.9-2.5-3.6zM14.2 6.1c.6-.7 1-1.8.9-2.8-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.2z" fill="currentColor" stroke="none" />,
};

export function Glyph({ name, size = 20, style, strokeWidth = 1.8 }: { name: string; size?: number; style?: CSSProperties; strokeWidth?: number }) {
  const body = P[name];
  if (!body || name === "none") return null;
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block", ...style }}>
      {body}
    </svg>
  );
}

/** Small UI glyphs for the builder chrome itself. */
export const ui = {
  up: <path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" />,
  down: <path d="M8 4v8M4.5 8.5L8 12l3.5-3.5" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></>,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" />,
  wrap: <><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M5.5 6h5M5.5 8h5M5.5 10h3" /></>,
  undo: <path d="M5 7H10a3 3 0 0 1 0 6H7M5 7l2.5-2.5M5 7l2.5 2.5" />,
  redo: <path d="M11 7H6a3 3 0 0 0 0 6h3M11 7L8.5 4.5M11 7L8.5 9.5" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  lock: <><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" /></>,
  question: <><circle cx="8" cy="8" r="6" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.6c-.5.3-.8.6-.8 1.2v.3M8 11.5v.1" /></>,
  sun: <><circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>,
  moon: <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />,
  download: <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />,
  sparkle: <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3z" />,
  plus: <path d="M8 3v10M3 8h10" />,
  layers: <><path d="M8 2.5L14 6 8 9.5 2 6z" /><path d="M2 9l6 3.5L14 9" /></>,
  code: <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />,
  phone: <><rect x="4.5" y="1.5" width="7" height="13" rx="1.8" /><path d="M7 12.5h2" /></>,
  sliders: <path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h2M7.5 11.5h6M9.5 3v3M5 10v3" />,
  more: <><circle cx="4" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="12" cy="8" r=".9" fill="currentColor" /></>,
} satisfies Record<string, ReactNode>;

export function UI({ name, size = 16, label }: { name: keyof typeof ui; size?: number; label?: string }) {
  return (
    <svg aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
      {ui[name]}
    </svg>
  );
}
