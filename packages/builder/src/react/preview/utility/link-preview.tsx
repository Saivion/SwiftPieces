"use client";
// Link Preview in the Playground: the card holds its size as a skeleton for a moment (the fetch), then the
// image settles and the text fades in. A tap dips it, a long press lifts it into Open Link / Copy Link /
// Share, and Copy Link really copies with a success haptic, as the Swift does. Email and phone links show the address card.
import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { house } from "../../../core/palette.js";
import { linkPreviewURL } from "../../../definitions/utility/link-preview.js";
import { Glyph } from "../../icons.js";
import { ACCENT, b, cr, fillStyle, font, houseVar, n, s, ts, useAxis, type Renderer, type RenderProps } from "../env.js";
import { BOUNCE, SPRING, useRuntime } from "../runtime.js";

const TILES = [house.blocks.sky, house.blocks.butter, house.blocks.sage, house.blocks.lilac, house.blocks.sand];

/** Same stable pick as `Style.tile(for:)` in Swift: djb2 over the lowercased host. */
function tile(host: string) {
  let h = BigInt(5381);
  const mask = BigInt("0xFFFFFFFFFFFFFFFF");
  for (const ch of host.toLowerCase()) h = (h * BigInt(33) + BigInt(ch.codePointAt(0) ?? 0)) & mask;
  return TILES[Number(h % BigInt(TILES.length))];
}

type Parsed = { web: boolean; host: string; address: string; kind: string; glyph: string };

/** Mirrors the Swift helpers: host without "www.", host + path as the address, a kind for email and phone links. */
function parse(raw: string): Parsed {
  try {
    const url = new URL(raw);
    const scheme = url.protocol.replace(/:$/, "").toLowerCase();
    const web = (scheme === "http" || scheme === "https") && !!url.hostname;
    if (url.hostname) {
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = decodeURIComponent(url.pathname).replace(/\/$/, "");
      return { web, host, address: host + path, kind: host, glyph: "link" };
    }
    const address = decodeURIComponent(raw.slice(scheme.length + 1)).replace(/^\/\//, "");
    const kinds: Record<string, [string, string]> = { mailto: ["Email", "envelope"], tel: ["Phone", "phone"], sms: ["Message", "bubble.left"] };
    const [kind, glyph] = kinds[scheme] ?? ["Link", "link"];
    return { web: false, host: address, address, kind, glyph };
  } catch {
    return { web: false, host: raw, address: raw, kind: "Link", glyph: "link" };
  }
}

const KEYFRAMES =
  "@keyframes lpb-sweep{from{background-position:120% 0}to{background-position:-120% 0}}" +
  "@keyframes lpb-settle{from{transform:scale(1.06);opacity:0}to{transform:none;opacity:1}}" +
  "@keyframes lpb-fade{from{opacity:0}to{opacity:1}}" +
  "@keyframes lpb-menu{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}" +
  "@media (prefers-reduced-motion: reduce){[data-lpb-motion]{animation:none!important}}";

const sweep: CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  background: "linear-gradient(106deg, transparent 30%, var(--h-empty) 50%, transparent 70%)",
  backgroundSize: "250% 100%", animation: "lpb-sweep 1.6s linear infinite",
};

function Bone({ w, h }: { w: string; h: number }) {
  return (
    <span style={{ position: "relative", display: "block", width: w, height: h, borderRadius: 4, background: houseVar("raised"), overflow: "hidden" }}>
      <span data-lpb-motion style={sweep} />
    </span>
  );
}

/** Sample cover art, the same shapes as the Swift example: a tram in the accent under its wire, in front of rooftops. */
function Cover() {
  return (
    <svg aria-hidden viewBox="0 0 573 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect width="573" height="300" fill={house.blocks.butter} />
      <g fill={house.blocks.lilac}>
        <path d="M0 140 L35 112 L70 140 V300 H0 Z" />
        <rect x="78" y="116" width="64" height="184" />
        <path d="M384 128 L419 100 L454 128 V300 H384 Z" />
        <rect x="462" y="104" width="60" height="196" />
        <path d="M530 146 L551 128 L573 146 V300 H530 Z" />
      </g>
      <path d="M0 46 L573 36" stroke={house.ink} strokeWidth="3" />
      <path d="M262 118 L292 80 L270 44 M322 118 L292 80 M254 42 H288" stroke={house.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="170" y="114" width="230" height="22" rx="8" fill={ACCENT} />
      <rect x="150" y="130" width="270" height="116" rx="20" fill={ACCENT} />
      <path d="M150 222 H420 V226 A20 20 0 0 1 400 246 H170 A20 20 0 0 1 150 226 Z" fill={house.ink} opacity="0.16" />
      <g fill={house.blocks.butter}>
        <rect x="168" y="148" width="40" height="42" rx="7" />
        <rect x="218" y="148" width="40" height="42" rx="7" />
        <rect x="268" y="148" width="40" height="42" rx="7" />
        <rect x="318" y="148" width="40" height="42" rx="7" />
        <rect x="370" y="148" width="34" height="84" rx="7" />
      </g>
      <rect x="0" y="256" width="573" height="44" fill={house.ink} />
      <path d="M0 272 H573" stroke={house.blocks.butter} strokeWidth="3" opacity="0.5" />
      <g fill={house.ink}>
        <circle cx="200" cy="248" r="13" />
        <circle cx="244" cy="248" r="13" />
        <circle cx="326" cy="248" r="13" />
        <circle cx="370" cy="248" r="13" />
      </g>
    </svg>
  );
}

function MenuGlyph({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const MENU = [
  { id: "open", label: "Open Link", d: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" },
  { id: "copy", label: "Copy Link", d: "M9 9h10v11H9zM5 15V4h10" },
  { id: "share", label: "Share", d: "M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" },
];

function Root({ r, style, children, ...rest }: { r: RenderProps; style?: CSSProperties; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const axis = useAxis();
  return <div {...r.box} {...rest} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const url = linkPreviewURL(p);
  const link = parse(url);
  const wanted = s(p, "phase") || "loaded";
  const supplied = b(p, "supplied");
  // The fetch a real card makes: a skeleton for a moment each time the link changes, unless metadata is supplied.
  const [fetching, setFetching] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [menu, setMenu] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (rt.still || supplied || wanted !== "loaded" || !link.web) {
      setFetching(false);
      return;
    }
    setFetching(true);
    const t = setTimeout(() => setFetching(false), 900);
    return () => clearTimeout(t);
  }, [url, wanted, supplied, link.web, rt.still]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!cardRef.current?.parentElement?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const phase: "loading" | "loaded" | "fallback" = !link.web || wanted === "fallback" ? "fallback" : wanted === "loading" || fetching ? "loading" : "loaded";
  const large = s(p, "layout") === "large" && phase !== "fallback";
  const title = s(p, "title").trim() || link.address;
  const hasImage = b(p, "image");
  const radius = n(p, "cornerRadius") || 18;

  const startHold = () => {
    held.current = false;
    setPressed(true);
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setPressed(false);
      setMenu(true);
      rt.haptic("medium", cardRef.current);
    }, 480);
  };
  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setPressed(false);
  };
  const choose = (id: string) => {
    setMenu(false);
    if (id === "copy") {
      navigator.clipboard?.writeText(url).catch(() => {});
      rt.haptic("success", cardRef.current);
    }
  };

  const meta: CSSProperties = { ...font("caption", 600), fontSize: ts(12), textTransform: "uppercase", letterSpacing: "0.03em", color: houseVar("muted"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const clamp: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" };
  const letter = (link.host.match(/\p{L}/u)?.[0] ?? "#").toUpperCase();

  const art = (compact: boolean) =>
    hasImage ? (
      <div data-lpb-motion style={{ position: "absolute", inset: 0, animation: `lpb-settle .5s ${SPRING} both` }}><Cover /></div>
    ) : (
      <div data-lpb-motion style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: tile(link.host), color: house.ink, fontFamily: "ui-rounded, -apple-system, system-ui", fontWeight: 800, fontSize: compact ? 28 : 60, animation: `lpb-settle .5s ${SPRING} both` }}>{letter}</div>
    );

  // The loaded text is always laid out (hidden while loading) and the bones sit over it, so the card keeps its
  // exact size when the content arrives, as the Swift skeleton does.
  const shown = phase === "loading" ? { title: "A page title long enough to run across two lines", kicker: link.host } : { title: phase === "fallback" ? link.address : title, kicker: phase === "fallback" ? link.kind : link.host };
  const text = (
    <div style={{ position: "relative", minWidth: 0, flex: 1 }}>
      <div data-lpb-motion style={{ display: "flex", flexDirection: "column", gap: 4, visibility: phase === "loading" ? "hidden" : "visible", animation: phase === "loading" ? undefined : "lpb-fade .35s ease-out both" }}>
        <span style={meta}>{shown.kicker}</span>
        <span style={{ ...clamp, ...font(large ? "headline" : "subheadline", 600), color: houseVar("text"), minHeight: large || phase === "loading" ? "2.6em" : undefined }}>{shown.title}</span>
      </div>
      {phase === "loading" ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBlock: "3px 4px" }}>
          <Bone w="32%" h={10} />
          <Bone w="100%" h={13} />
          <Bone w="70%" h={13} />
        </div>
      ) : null}
    </div>
  );

  return (
    <Root r={r} style={{ position: "relative", color: houseVar("text") }}>
      <style>{KEYFRAMES}</style>
      <div
        ref={cardRef}
        role="link"
        aria-label={phase === "loaded" ? `${title}, ${link.host}` : link.address}
        tabIndex={0}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (held.current) return;
          rt.haptic("light", cardRef.current);
        }}
        data-lpb-motion
        style={{
          position: "relative", zIndex: menu ? 3 : undefined, overflow: "hidden", cursor: "pointer", userSelect: "none",
          borderRadius: cr(radius), background: houseVar("surface"),
          transform: pressed ? "scale(.97)" : menu ? "scale(1.02)" : "none",
          boxShadow: menu ? "0 18px 40px rgba(0,0,0,.28)" : "none",
          transition: `transform .3s ${BOUNCE}, box-shadow .3s`,
        }}
      >
        {large ? (
          <>
            <div style={{ position: "relative", aspectRatio: "1.91 / 1", maxHeight: 280, background: houseVar("raised"), overflow: "hidden" }}>
              {phase === "loading" ? <span data-lpb-motion style={sweep} /> : art(false)}
            </div>
            <div style={{ padding: "12px 16px 14px" }}>{text}</div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px 8px 8px" }}>
            <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0, borderRadius: cr(Math.max(radius - 8, 4)), overflow: "hidden", background: houseVar("raised"), display: "grid", placeItems: "center", color: houseVar("muted") }}>
              {phase === "loading" ? <span data-lpb-motion style={sweep} /> : phase === "fallback" ? <Glyph name={link.glyph} size={22} /> : art(true)}
            </div>
            {text}
          </div>
        )}
      </div>
      {menu ? (
        <div
          data-lpb-motion
          role="menu"
          style={{ position: "absolute", zIndex: 4, top: "calc(100% + 8px)", left: 4, width: 230, borderRadius: 14, overflow: "hidden", background: houseVar("raised"), boxShadow: "0 14px 34px rgba(0,0,0,.3)", transformOrigin: "top left", animation: `lpb-menu .35s ${BOUNCE} both` }}
        >
          {MENU.map((m, k) => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              onClick={() => choose(m.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height: 44, padding: "0 14px", border: 0, borderTop: k ? `1px solid ${r.scheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` : 0, background: "transparent", color: "inherit", font: "inherit", fontSize: ts(16), cursor: "pointer" }}
            >
              <span>{m.label}</span>
              <MenuGlyph d={m.d} />
            </button>
          ))}
        </div>
      ) : null}
    </Root>
  );
};
