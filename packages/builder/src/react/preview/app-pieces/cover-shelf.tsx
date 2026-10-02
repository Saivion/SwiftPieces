"use client";
import { useState } from "react";
import { records } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, fw, ts } from "../env.js";
import { BOUNCE, useTap } from "../runtime.js";
import { BookCover } from "./book-cover.js";
import { LABEL, WideRoot, useHaptic } from "./data-kit.js";

export const CoverShelf: Renderer = (r) => {
  const books = records(s(r.p, "books"), 10);
  const w = n(r.p, "coverWidth") || 132;
  const [lifted, setLifted] = useState<number | null>(null);
  const haptic = useHaptic();
  const tap = useTap(r.p.link);
  const action = s(r.p, "action");
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ flex: 1, fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600), color: LABEL }}>{s(r.p, "title")}</span>
        {action ? (
          <span role="button" onClick={(e) => tap(e)} style={{ fontSize: ts(15), fontWeight: fw(500), color: "var(--ios-accent)", cursor: "pointer" }}>{action}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 4px", scrollbarWidth: "none", margin: "0 -4px" }}>
        {books.map(([title = "", author = ""], i) => (
          <div
            key={i}
            onClick={(e) => {
              haptic("selection", e.currentTarget);
              setLifted((c) => (c === i ? null : i));
            }}
            style={{ cursor: "pointer", transform: lifted === i ? "scale(1.05)" : undefined, zIndex: lifted === i ? 1 : 0, transition: `transform .3s ${BOUNCE}` }}
          >
            <BookCover title={title} author={author} width={w} delay={Math.min(i, 8) * 0.04} />
          </div>
        ))}
      </div>
    </WideRoot>
  );
};
