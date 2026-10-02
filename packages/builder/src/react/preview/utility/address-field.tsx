"use client";
// Address Field in the Playground: type three characters and, after a short pause, suggestions from a set of
// sample addresses load under the field with the match in bold (the spinner shows while they load). Click a
// row, or use the arrow keys and Return, and the row spins while it "resolves", then the list folds away and
// the field settles into the street with the locality underneath and a sage check, as the Swift does.
// Editing clears the address; Escape closes the list; "Use as typed" appears when nothing matches.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { house } from "../../../core/palette.js";
import { SAMPLE_ADDRESSES, countryCodes, sampleLocality, sampleSubtitle, type SampleAddress } from "../../../definitions/utility/address-field.js";
import { Glyph } from "../../icons.js";
import { ACCENT, cr, fillStyle, font, houseVar, s, useAxis, type Renderer } from "../env.js";
import { BOUNCE, SPRING, useLive, useRuntime } from "../runtime.js";

const ERROR = "#FF0000";
const HIGHLIGHT = "color-mix(in srgb, var(--h-text) 9%, var(--h-field))";
const MIN_QUERY = 3;
const corner = (r: number) => cr(r) as string;

const KEYFRAMES =
  "@keyframes afb-spin{to{transform:rotate(360deg)}}" +
  "@keyframes afb-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}" +
  "@keyframes afb-fade{from{opacity:0}to{opacity:1}}" +
  "@media (prefers-reduced-motion: reduce){[data-afb-motion]{animation:none!important;transition:none!important}}";

const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type Resolved = { kind: "verified"; address: SampleAddress } | { kind: "typed"; text: string };
type Status = "idle" | "loaded" | "empty" | "failed";

/** Sample search: title or locality contains the query, addresses outside `countries` left out, at most five. */
function search(query: string, countries: string[]): SampleAddress[] {
  const q = fold(query.trim());
  return SAMPLE_ADDRESSES.filter((a) => (!countries.length || countries.includes(a.code)) && (fold(a.street).includes(q) || fold(sampleSubtitle(a)).includes(q))).slice(0, 5);
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Path({ d, size, stroke = 2.2 }: { d: string; size: number; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}
const PIN_ELLIPSE = "M12 4.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2M12 9.7V17M8 15.2c-2.4.45-4 1.3-4 2.3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5c0-1-1.6-1.85-4-2.3";
const PIN = "M12 3.5a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6M12 9.1V20.5";
/** Suggestion tiles: small solid blocks with the pin in ink, as `Style.tiles` in Swift. */
const TILES = [house.blocks.sky, house.blocks.butter, house.blocks.sage, house.blocks.lilac];
const CURSOR = "M4 18l3.5-10L11 18M5.3 14.5h4.4M16 5h2m2 0h-2m0 0v14m-2 0h2m2 0h-2";
const CHECK = "M5.5 12.5l4.2 4.2L18.5 7.5";

/** The system activity indicator: eight spokes stepping around. */
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg data-afb-motion aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, animation: "afb-spin .8s steps(8) infinite" }}>
      {Array.from({ length: 8 }, (_, k) => (
        <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" opacity={0.25 + (0.75 * k) / 7} transform={`rotate(${k * 45} 12 12)`} />
      ))}
    </svg>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? fold(text).indexOf(fold(q)) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<b style={{ fontWeight: 700 }}>{text.slice(at, at + q.length)}</b>{text.slice(at + q.length)}</>;
}

const AddressField: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const phase = s(p, "phase") || "empty";
  const countries = useMemo(() => countryCodes(p), [p.countries]);
  const allowsTyped = p.allowsUnverified !== false;
  const seedQuery = phase === "unverified" ? s(p, "query") || "Flat 3, 12 Harbour Row" : s(p, "query");

  // Everything below is seeded from the props and reset when they change, like a fresh @State.
  const seed = useMemo(() => {
    const listed = phase === "suggestions" || phase === "resolving";
    const found = listed ? search(seedQuery, countries) : [];
    return {
      text: phase === "resolved" ? SAMPLE_ADDRESSES[0].street : phase === "empty" ? "" : seedQuery,
      resolved: (phase === "resolved" ? { kind: "verified", address: SAMPLE_ADDRESSES[0] } : phase === "unverified" ? { kind: "typed", text: seedQuery } : null) as Resolved | null,
      results: found,
      status: (phase === "error" ? "failed" : listed ? (found.length ? "loaded" : "empty") : "idle") as Status,
      active: listed || phase === "error",
      resolving: phase === "resolving" && found.length ? 0 : null,
    };
  }, [phase, seedQuery, countries]);

  const [text, setText] = useLive(seed.text);
  const [resolved, setResolved] = useLive<Resolved | null>(seed.resolved);
  const [results, setResults] = useLive<SampleAddress[]>(seed.results);
  const [status, setStatus] = useLive<Status>(seed.status);
  const [active, setActive] = useLive(seed.active);
  const [resolving, setResolving] = useLive<number | null>(seed.resolving);
  const [failure, setFailure] = useState<{ index: number; message: string; retry: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
  }, []);

  /** Debounce, then a short "network" wait. A newer keystroke bumps the generation, so a late answer is dropped. */
  const runSearch = useCallback((query: string, debounce = 250) => {
    const mine = ++generation.current;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < MIN_QUERY) {
      setLoading(false);
      setResults([]);
      setStatus("idle");
      return;
    }
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      searchTimer.current = setTimeout(() => {
        if (mine !== generation.current) return;
        const found = search(query, countries);
        setLoading(false);
        setResults(found);
        setStatus(found.length ? "loaded" : "empty");
        setHighlight((h) => (h && found.some((a) => a.street === h) ? h : null));
      }, 380);
    }, debounce);
  }, [countries, setResults, setStatus]);

  const cancelResolve = () => {
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    setResolving(null);
    setFailure(null);
  };

  const onType = (value: string) => {
    cancelResolve();
    setHighlight(null);
    setText(value);
    setResolved(null);
    setActive(true);
    runSearch(value);
  };

  const pick = (index: number) => {
    const address = results[index];
    if (!address) return;
    cancelResolve();
    setHighlight(address.street);
    setResolving(index);
    rt.haptic("soft", rootRef.current);
    resolveTimer.current = setTimeout(() => {
      setResolving(null);
      if (countries.length && !countries.includes(address.code)) {
        const message = countries.length === 1 ? `Choose an address in ${countryName(countries[0])}` : "Choose an address in a supported country";
        setFailure({ index, message, retry: false });
        rt.haptic("error", rootRef.current);
        return;
      }
      setResolved({ kind: "verified", address });
      setText(address.street);
      setActive(false);
      setStatus("idle");
      setResults([]);
      rt.haptic("success", rootRef.current);
      inputRef.current?.blur();
    }, 750);
  };

  const keepTyped = () => {
    const typed = text.trim();
    if (!typed) return;
    cancelResolve();
    setResolved({ kind: "typed", text: typed });
    setActive(false);
    setStatus("idle");
    setResults([]);
    rt.haptic("soft", rootRef.current);
    inputRef.current?.blur();
  };

  const clear = () => {
    cancelResolve();
    generation.current++;
    setText("");
    setResolved(null);
    setResults([]);
    setStatus("idle");
    setLoading(false);
    inputRef.current?.focus();
  };

  // Rows in the list, in keyboard order. The list shows while active, or while a pick resolves or failed.
  const query = text.trim();
  const showsTyped = allowsTyped && (status === "empty" || status === "failed" || failure !== null);
  const visible = !resolved && query.length >= MIN_QUERY && status !== "idle" && (active || resolving !== null || failure !== null);
  const pickable: string[] = visible ? [...(status === "loaded" ? results.map((a) => a.street) : []), ...(showsTyped ? ["\u0000typed"] : [])] : [];

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!pickable.length) return;
      e.preventDefault();
      const at = highlight ? pickable.indexOf(highlight) : -1;
      const next = at < 0 ? (e.key === "ArrowDown" ? 0 : pickable.length - 1) : Math.min(Math.max(at + (e.key === "ArrowDown" ? 1 : -1), 0), pickable.length - 1);
      if (pickable[next] !== highlight) {
        setHighlight(pickable[next]);
        rt.haptic("selection", rootRef.current);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = (highlight && pickable.includes(highlight) ? highlight : pickable[0]) ?? null;
      if (target === "\u0000typed") keepTyped();
      else if (target) pick(results.findIndex((a) => a.street === target));
    } else if (e.key === "Escape" && active) {
      e.preventDefault();
      setActive(false);
    }
  };

  const verified = resolved?.kind === "verified" ? resolved.address : null;
  const secondLine = verified ? sampleLocality(verified) : resolved ? "Used as typed" : null;
  const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "8px 10px", boxSizing: "border-box", borderRadius: corner(12), border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "start", cursor: "pointer" };

  return (
    <div ref={rootRef} {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", flexDirection: "column", gap: 8, color: houseVar("text") }}>
      <style>{KEYFRAMES}</style>
      {/* Field */}
      <div
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        style={{
          display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 8px 8px 16px", boxSizing: "border-box",
          borderRadius: corner(18), background: houseVar("field"), cursor: "text",
          boxShadow: focused ? `inset 0 0 0 2px ${ACCENT}` : "none", transition: "box-shadow .2s",
        }}
      >
        <span style={{ color: ACCENT, display: "flex", width: 32, justifyContent: "center", flexShrink: 0 }}><Path d={PIN_ELLIPSE} size={21} stroke={2.2} /></span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <input
            ref={inputRef}
            value={text}
            placeholder={s(p, "label") || "Address"}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true);
              if (!resolved && status !== "idle") setActive(true);
            }}
            onBlur={() => {
              setFocused(false);
              setActive(false);
            }}
            aria-label={s(p, "label") || "Address"}
            autoComplete="street-address"
            spellCheck={false}
            style={{ border: 0, outline: 0, background: "transparent", color: houseVar("text"), padding: 0, width: "100%", ...font("body"), lineHeight: "24px" }}
          />
          {secondLine ? <span data-afb-motion style={{ ...font("subheadline"), color: houseVar("muted"), animation: "afb-fade .3s ease both" }}>{secondLine}</span> : null}
        </div>
        <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", flexShrink: 0, color: houseVar("muted") }}>
          {loading && !resolved ? (
            <Spinner />
          ) : verified ? (
            <span data-afb-motion style={{ width: 26, height: 26, borderRadius: "50%", background: house.blocks.sage, color: house.ink, display: "grid", placeItems: "center", animation: `afb-pop .45s ${BOUNCE} both` }}>
              <Path d={CHECK} size={15} stroke={3.4} />
            </span>
          ) : focused && text ? (
            <button type="button" aria-label="Clear address" onPointerDown={(e) => e.preventDefault()} onClick={clear} style={{ border: 0, padding: 0, background: "none", color: "inherit", cursor: "pointer", display: "grid", placeItems: "center", width: 44, height: 44 }}>
              <Glyph name="xmark.circle.fill" size={18} />
            </button>
          ) : null}
        </span>
      </div>

      {/* Suggestions */}
      <div data-afb-motion style={{ display: "grid", gridTemplateRows: visible ? "1fr" : "0fr", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(-6px)", transition: `grid-template-rows .4s ${SPRING}, opacity .25s, transform .35s ${SPRING}` }}>
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div role="listbox" aria-label="Address suggestions" style={{ padding: 6, borderRadius: corner(18), background: houseVar("field") }}>
            {status === "failed" ? (
              <div style={{ ...row, cursor: "default" }}>
                <span style={{ width: 24, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: ERROR, color: house.ink, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>!</span>
                </span>
                <span style={{ flex: 1, ...font("subheadline", 500) }}>Couldn&rsquo;t load suggestions</span>
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => { setStatus("loaded"); runSearch(text, 0); }} style={{ border: 0, cursor: "pointer", padding: "6px 12px", borderRadius: 999, background: houseVar("text"), color: houseVar("field"), ...font("subheadline", 600) }}>Retry</button>
              </div>
            ) : status === "empty" ? (
              <div style={{ ...font("subheadline"), color: houseVar("muted"), padding: "10px 10px 10px 54px" }}>No matching addresses</div>
            ) : (
              results.map((a, k) => {
                const spinning = resolving === k;
                const failed = failure?.index === k ? failure : null;
                const on = highlight === a.street || spinning;
                return (
                  <button
                    key={a.street}
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-afb-motion
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(k)}
                    style={{ ...row, background: on ? HIGHLIGHT : "transparent", opacity: resolving !== null && !spinning ? 0.4 : 1, transition: "background-color .15s, opacity .2s" }}
                  >
                    <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: TILES[k % TILES.length], color: house.ink, display: "grid", placeItems: "center" }}><Path d={PIN} size={17} stroke={2.6} /></span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ ...font("body"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlighted text={a.street} query={query} /></span>
                      <span style={{ ...font("subheadline", failed ? 500 : undefined), color: failed ? ERROR : houseVar("muted"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{failed ? failed.message : sampleSubtitle(a)}</span>
                    </span>
                    {spinning ? <span style={{ display: "flex", color: houseVar("text") }}><Spinner /></span> : null}
                    {failed?.retry ? <span style={{ padding: "6px 12px", borderRadius: 999, background: houseVar("text"), color: houseVar("field"), ...font("subheadline", 600) }}>Retry</span> : null}
                  </button>
                );
              })
            )}
            {showsTyped ? (
              <button
                type="button"
                role="option"
                aria-selected={highlight === "\u0000typed"}
                onPointerDown={(e) => e.preventDefault()}
                onClick={keepTyped}
                style={{ ...row, background: highlight === "\u0000typed" ? HIGHLIGHT : "transparent", opacity: resolving !== null ? 0.4 : 1 }}
              >
                <span style={{ color: houseVar("muted"), display: "flex", width: 32, justifyContent: "center", flexShrink: 0 }}><Path d={CURSOR} size={19} stroke={2} /></span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ ...font("body", 500), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Use &ldquo;{query}&rdquo;</span>
                  <span style={{ ...font("subheadline"), color: houseVar("muted") }}>Keep it exactly as typed</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export const renderer: Renderer = AddressField;
