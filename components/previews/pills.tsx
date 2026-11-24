"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground, signal } from "./palette";
import { reduced, t as tr } from "./piece-motion";
import { Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/* Pills: Date Pill, Guests Pill, Reminder Pill. Each is a glass pill that grows its panel out of itself, joined
   beneath it as one piece of liquid glass, the way the Swift pieces' shell does: born the pill's own size on top of
   it, drawn down into place, then drained back before the pill's text morphs. The stage is 4:3; one iOS point is
   0.16cqw, so the stage is 625 x 469 points and a full month fits under its pill. */

const UNIT = "0.16cqw";
const u = (n: number) => `${+(n * 0.16).toFixed(3)}cqw`;
const PILL_H = 44;

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600, paddingTop: u(46) }}>
      {children}
    </div>
  );
}

function Glyph({ d, size, color, stroke = 2.2 }: { d: string; size: number; color?: string; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size), flexShrink: 0, color, transition: "color 200ms ease-out" }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICON = {
  calendar: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  sunrise: "M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M5 9l1.5 1.5M19 9l-1.5 1.5M9 7l3-3 3 3",
  week: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 12h6M13 9l3 3-3 3",
  prev: "M14.5 5.5 8 12l6.5 6.5",
  next: "M9.5 5.5 16 12l-6.5 6.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
} as const;

/** Runs `script` in a loop until the preview unmounts. Under Reduce Motion it never starts: the first frame holds. */
function useLoop(script: (wait: (ms: number) => Promise<void>) => Promise<void>) {
  useEffect(() => {
    if (reduced()) return;
    let alive = true;
    const timers = new Set<number>();
    const wait = (ms: number) => new Promise<void>((resolve) => {
      const id = window.setTimeout(() => { timers.delete(id); if (alive) resolve(); }, ms);
      timers.add(id);
    });
    (async () => { while (alive) await script(wait); })();
    return () => { alive = false; timers.forEach((id) => clearTimeout(id)); };
  }, []);
}

/** The pill and the panel that grows out of it. `width` is the pill's width; the panel is `panel` points. */
function PillShell({ open, width, panel, lead, label, children }: {
  open: boolean;
  width: number;
  panel: [number, number];
  lead: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [pw, ph] = panel;
  const w = open ? pw : width, h = open ? ph : PILL_H;
  const spring = open ? liquid.split : liquid.home;
  return (
    <LiquidGroup unit={UNIT} axis="y">
      <div className="relative flex flex-col items-center" style={{ width: u(pw), height: u(PILL_H + liquid.joined + ph) }}>
        <Liquid radius="capsule" className="flex items-center justify-center" style={{ height: u(PILL_H), width: u(width), gap: u(8), fontSize: u(17), color: ground.text, transition: tr("width", "morph") }}>
          {lead}
          <MorphText text={label} />
        </Liquid>
        <Liquid radius={open ? 28 : PILL_H / 2} className="absolute overflow-hidden" style={{
          top: u(open ? PILL_H + liquid.joined : 0), left: `calc(50% - ${u(w / 2)})`, width: u(w), height: u(h),
          transition: tr(["top", "left", "width", "height", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"], spring),
        }}>
          <div className="absolute top-0" style={{
            left: `calc(50% - ${u(pw / 2)})`, width: u(pw), height: u(ph), color: ground.text,
            opacity: open ? 1 : 0, filter: `blur(${open ? 0 : 6}px)`,
            transition: open ? "opacity 300ms ease-out 140ms, filter 300ms ease-out 140ms" : "opacity 140ms ease-out, filter 140ms ease-out",
          }}>
            {children}
          </div>
        </Liquid>
      </div>
    </LiquidGroup>
  );
}

// MARK: Date Pill

const MONTH = { name: "November 2026", lead: 0, days: 30, today: 24 };
const DATE_W = 300, DATE_ROW = 38;
const dateLabel = (day: number) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(MONTH.lead + day - 1) % 7]}, Nov ${day}`;

export function DatePillPreview() {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(27);
  const [shown, setShown] = useState(27);
  useLoop(async (wait) => {
    await wait(700); setOpen(true);
    await wait(1000); setDay((d) => (d === 27 ? 29 : 27));
    await wait(700); setOpen(false);
    await wait(220); setDay((d) => { setShown(d); return d; });
    await wait(2000);
  });
  const rows = Math.ceil((MONTH.lead + MONTH.days) / 7);
  const cell = (DATE_W - 24) / 7;
  const at = MONTH.lead + day - 1;
  return (
    <Stage>
      <PillShell open={open} width={170} panel={[DATE_W, 56 + 24 + rows * DATE_ROW + 10]} lead={<Glyph d={ICON.calendar} size={18} color={ground.muted} />} label={dateLabel(shown)}>
        <div className="flex items-center justify-between" style={{ height: u(56), paddingInline: u(18), fontSize: u(17) }}>
          {MONTH.name}
          <span className="flex" style={{ gap: u(14), color: ground.muted }}><Glyph d={ICON.prev} size={18} /><Glyph d={ICON.next} size={18} /></span>
        </div>
        <div className="flex" style={{ paddingInline: u(12), height: u(24), fontSize: u(12), color: ground.muted }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="text-center" style={{ width: u(cell) }}>{d}</span>)}
        </div>
        <div className="relative" style={{ marginInline: u(12), height: u(rows * DATE_ROW) }}>
          <span className="absolute rounded-full" style={{ width: u(34), height: u(34), background: signal.fill, left: u((at % 7) * cell + (cell - 34) / 2), top: u(Math.floor(at / 7) * DATE_ROW + 2), transition: tr(["left", "top"], "snap") }} />
          {Array.from({ length: MONTH.days }, (_, i) => {
            const n = MONTH.lead + i;
            const color = i + 1 === day ? signal.on : i + 1 === MONTH.today ? signal.fill : i + 1 < MONTH.today ? ground.subtle : ground.text;
            return (
              <span key={i} className="absolute grid place-items-center" style={{ left: u((n % 7) * cell), top: u(Math.floor(n / 7) * DATE_ROW), width: u(cell), height: u(DATE_ROW), fontSize: u(16), color, transition: "color 200ms ease-out" }}>
                {i + 1}
              </span>
            );
          })}
        </div>
      </PillShell>
    </Stage>
  );
}

// MARK: Guests Pill

const GUEST_ROWS = [
  { id: "adults", title: "Adults", detail: "Ages 13 or above", min: 1 },
  { id: "children", title: "Children", detail: "Ages 2 to 12", min: 0 },
  { id: "pets", title: "Pets", detail: "Service animals welcome", min: 0 },
] as const;
const guestsLabel = ([a, c, p]: number[]) => `${a + c} ${a + c === 1 ? "guest" : "guests"}${p ? `, ${p} ${p === 1 ? "pet" : "pets"}` : ""}`;

export function GuestsPillPreview() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState([2, 0, 0]);
  const [shown, setShown] = useState("2 guests");
  const [flash, setFlash] = useState<string | null>(null);
  useLoop(async (wait) => {
    let now = [2, 0, 0];
    const tap = async (row: number, delta: number) => {
      now = now.map((v, i) => (i === row ? v + delta : v));
      setCounts(now); setFlash(`${row}${delta}`);
      await wait(260); setFlash(null); await wait(340);
    };
    await wait(700); setOpen(true);
    await wait(900); await tap(1, 1); await tap(0, 1); await tap(2, 1);
    await wait(500); setOpen(false);
    await wait(220); setShown(guestsLabel(now));
    await wait(2000);
    setOpen(true); await wait(900); await tap(0, -1); await tap(1, -1); await tap(2, -1);
    await wait(400); setOpen(false); await wait(220); setShown(guestsLabel(now)); await wait(1400);
  });
  return (
    <Stage>
      <PillShell open={open} width={shown.includes("pet") ? 196 : 140} panel={[300, GUEST_ROWS.length * 60 + 12]} lead={<Glyph d={ICON.person} size={18} color={ground.muted} />} label={shown}>
        <div style={{ paddingBlock: u(6) }}>
          {GUEST_ROWS.map((row, i) => (
            <div key={row.id} className="flex items-center" style={{ height: u(60), paddingLeft: u(18), paddingRight: u(12), gap: u(10), borderTop: i ? `1px solid ${ground.line}` : undefined, fontSize: u(17) }}>
              <span className="flex flex-1 flex-col">
                {row.title}
                <span style={{ fontSize: u(12), color: ground.muted }}>{row.detail}</span>
              </span>
              {[-1, 1].map((delta) => {
                const lit = flash === `${i}${delta}`;
                const enabled = delta < 0 ? counts[i] > row.min : true;
                const button = (
                  <span key={delta} className="grid place-items-center rounded-full" style={{
                    width: u(36), height: u(36), background: lit ? signal.fill : ground.control, color: lit ? signal.on : ground.text, opacity: enabled ? 1 : 0.35,
                    transform: `scale(${lit ? 1.1 : 1})`, transition: "background-color 200ms ease-out, color 200ms ease-out, transform 180ms cubic-bezier(.3,1.6,.5,1), opacity 200ms ease-out",
                  }}>
                    <Glyph d={delta > 0 ? ICON.plus : ICON.minus} size={14} stroke={2.6} />
                  </span>
                );
                return delta < 0 ? button : [
                  <span key="n" className="text-center tabular-nums" style={{ minWidth: u(26) }}>{counts[i]}</span>,
                  button,
                ];
              })}
            </div>
          ))}
        </div>
      </PillShell>
    </Stage>
  );
}

// MARK: Reminder Pill

const REMINDERS = [
  { icon: ICON.clock, title: "Later today", detail: "6:00 PM", label: "Today, 6 PM" },
  { icon: ICON.sunrise, title: "Tomorrow", detail: "Wed 9:00 AM", label: "Tomorrow, 9 AM" },
  { icon: ICON.calendar, title: "This weekend", detail: "Sat 9:00 AM", label: "Saturday, 9 AM" },
  { icon: ICON.week, title: "Next week", detail: "Mon 9:00 AM", label: "Monday, 9 AM" },
] as const;
const REMIND_ROW = 44;

export function ReminderPillPreview() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  useLoop(async (wait) => {
    for (const i of [1, 2]) {
      await wait(700); setPicked(null); setOpen(true);
      await wait(1000); setPicked(i);
      await wait(600); setOpen(false);
      await wait(220); setShown(i);
      await wait(1800); setShown(null);
      await wait(400);
    }
  });
  const label = shown === null ? "Remind me" : REMINDERS[shown].label;
  const bell = shown === null ? ground.muted : signal.fill;
  return (
    <Stage>
      <PillShell open={open} width={shown === null ? 146 : 186} panel={[280, REMINDERS.length * REMIND_ROW + 12]} lead={<Glyph d={ICON.bell} size={18} color={bell} />} label={label}>
        <div className="relative" style={{ paddingBlock: u(6) }}>
          <span className="absolute" style={{
            left: u(6), right: u(6), height: u(REMIND_ROW - 4), top: u(6 + (picked ?? 0) * REMIND_ROW + 2), borderRadius: u(16), background: signal.fill,
            opacity: picked === null ? 0 : 1, transition: `${tr("top", "snap")}, opacity 160ms ease-out`,
          }} />
          {REMINDERS.map((r, i) => {
            const on = picked === i;
            return (
              <div key={r.title} className="relative flex items-center" style={{ height: u(REMIND_ROW), paddingInline: u(16), gap: u(10), fontSize: u(17), color: on ? signal.on : ground.text, transition: "color 200ms ease-out" } as CSSProperties}>
                <span className="grid place-items-center" style={{ width: u(22), color: on ? signal.on : ground.muted }}><Glyph d={r.icon} size={18} /></span>
                {r.title}
                <span className="ml-auto tabular-nums" style={{ fontSize: u(13), opacity: on ? 0.75 : 1, color: on ? signal.on : ground.muted }}>{r.detail}</span>
              </div>
            );
          })}
        </div>
      </PillShell>
    </Stage>
  );
}
