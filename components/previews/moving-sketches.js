/* Canvas sketches for the moving pieces of 2026-11-23, drawn in a 33-unit square. Each entry is
 [loop seconds, draw]. moving.tsx runs them on a canvas with the stage's colours. Plain JS: these are
 frame-by-frame drawings, ported from the approved round sketches. */
/* eslint-disable */
const RAMP = ["#ffc1d6", "#ff8a5c", "#f2361c"];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (lt, a, b) => clamp((lt - a) / (b - a));
const eo = p => 1 - (1 - p) ** 3;
const lerp = (a, b, p) => a + (b - a) * p;
const spr = (dt, k = 7, w = 11) => dt <= 0 ? 0 : 1 - Math.exp(-k * dt) * Math.cos(w * dt);
const bump = (dt, k = 7, w = 13) => dt <= 0 ? 0 : Math.exp(-k * dt) * Math.sin(w * dt);
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const P2 = {}; const ip = d => P2[d] || (P2[d] = new Path2D(d));
const IC = {
  heart: "M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.4 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z",
  check: "M5 12.5l4.5 4.5L19 7", eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
  eyeOff: "M3 3l18 18 M10.6 5.6A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-2.6 3.4 M6.3 6.6C3.6 8.4 2 12 2 12s3.6 6.5 10 6.5c1.6 0 3-.4 4.2-1 M9.9 10a3 3 0 0 0 4.2 4.2",
  share: "M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7.5h14V12", sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  arrowUp: "M12 19V5M6 11l6-6 6 6", reply: "M9.5 8.5V5L3 11.5 9.5 18v-3.6c4.6 0 7.9 1.5 10.5 4.6-1-4.8-3.8-9.6-10.5-10.5z",
  thumb: "M7 10.5V20H4v-9.5z M7 10.5l3.6-6.8c1.5 0 2.6 1.1 2.3 2.7L12.4 9.6h6.2a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.6H7",
  x: "M6 6l12 12M18 6L6 18", copy: "M8 8h11v11H8z M5 16V5h11", phone: "M5 4h3.5l1.7 4.2-2.2 1.4a11 11 0 0 0 6.4 6.4l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z",
  play: "M8 5.5v13l10.5-6.5z", moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z", sun: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
};
function icon(x, d, cx, cy, size, stroke, { lw = 2, fill = null } = {}) { x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24); if (fill) { x.fillStyle = fill; x.fill(ip(d)); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.lineCap = x.lineJoin = "round"; x.stroke(ip(d)); } x.restore(); }
const rr = (x, X, Y, W, H, R) => { x.beginPath(); x.roundRect(X, Y, W, H, Math.max(0, Math.min(R, W / 2, H / 2))); };
/** Liquid glass on the web: a frosted, see-through fill with a light rim and a soft shadow. `tint` paints it solid inside. */
function liquid(x, c, u, X, Y, W, H, R, tint = null) { x.save(); x.shadowColor = c.dark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.12)"; x.shadowBlur = 1.6 * u; x.shadowOffsetY = .6 * u; x.fillStyle = tint || (c.dark ? "rgba(46,46,46,0.62)" : "rgba(255,255,255,0.62)"); rr(x, X, Y, W, H, R); x.fill(); x.shadowColor = "transparent"; const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, c.dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.95)"); g.addColorStop(1, c.dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.35)"); x.strokeStyle = g; x.lineWidth = .12 * u; rr(x, X + .06 * u, Y + .06 * u, W - .12 * u, H - .12 * u, Math.max(0, R - .06 * u)); x.stroke(); x.restore(); }
function glassFill(x, c, u, X, Y, W, H, R, fill = c.glass) { x.save(); x.shadowColor = c.shadow; x.shadowBlur = 1.4 * u; x.shadowOffsetY = .5 * u; x.fillStyle = fill; rr(x, X, Y, W, H, R); x.fill(); x.restore(); }
let FAM = "-apple-system, system-ui, sans-serif";
export const setFont = f => { FAM = f; };
const font = (px, w = 600) => `${w} ${px}px ${FAM}`;
function txt(x, s, X, Y, px, color, align = "center", w = 600) { x.font = font(px, w); x.textAlign = align; x.textBaseline = "middle"; x.fillStyle = color; x.fillText(s, X, Y); }
const tw = (x, s, px, w = 600) => { x.font = font(px, w); return x.measureText(s).width; };
const mkc = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return [c, c.getContext("2d")]; };

/* particles */
function burst(arr, X, Y, n, u, { sp = 10, life = .9, size = .3, cols = RAMP, spread = 6.283, ang = 0, g = 0, star = 0 } = {}) {
  for (let i = 0; i < n; i++) { const a = ang + (Math.random() - .5) * spread, v = sp * u * (.35 + Math.random() * .85); arr.push({ x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, L: life * (.6 + Math.random() * .6), r: size * u * (.5 + Math.random()), c: cols[i % cols.length], g: g * u, s: star && Math.random() < star }); }
}
function stepP(x, arr, dt, drag = 3.2) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i]; p.l += dt; if (p.l > p.L) { arr.splice(i, 1); continue; }
    const f = Math.exp(-drag * dt); p.vx *= f; p.vy *= f; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.l / p.L; x.globalAlpha = Math.min(1, a * 1.4); x.fillStyle = p.c;
    if (p.s) { const r = p.r * 2.2 * a; x.beginPath(); x.moveTo(p.x, p.y - r); x.quadraticCurveTo(p.x, p.y, p.x + r, p.y); x.quadraticCurveTo(p.x, p.y, p.x, p.y + r); x.quadraticCurveTo(p.x, p.y, p.x - r, p.y); x.quadraticCurveTo(p.x, p.y, p.x, p.y - r); x.fill(); }
    else { x.beginPath(); x.arc(p.x, p.y, p.r * (.45 + .55 * a), 0, 6.283); x.fill(); }
  }
  x.globalAlpha = 1;
}
function drawPhoto(x, img, X, Y, W, H, R, { shadow = null, u = 0 } = {}) {
  x.save(); if (shadow) { x.shadowColor = shadow; x.shadowBlur = 1.2 * u; x.shadowOffsetY = .4 * u; rr(x, X, Y, W, H, R); x.fillStyle = "#000"; x.fill(); x.shadowColor = "transparent"; }
  rr(x, X, Y, W, H, R); x.clip(); x.drawImage(img, X, Y, W, H); x.restore();
}

/* round 15 helpers */
function cover(x, img, X, Y, W, H, R) { const iw = img.width, ih = img.height, s = Math.max(W / iw, H / ih), sw = W / s, sh = H / s; x.save(); rr(x, X, Y, W, H, R); x.clip(); x.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, X, Y, W, H); x.restore(); }
function sh(x, c, u, X, Y, W, H, R, k = 1) { x.save(); x.shadowColor = c.shadow; x.shadowBlur = 1.2 * u * k; x.shadowOffsetY = .45 * u * k; x.fillStyle = "#000"; rr(x, X, Y, W, H, R); x.fill(); x.restore(); }
function checkBadge(x, c, u, X, Y, s = 1, r = 1) { if (s <= 0) return; x.save(); x.translate(X, Y); x.scale(s, s); x.fillStyle = c.signal; x.beginPath(); x.arc(0, 0, r * u, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = .18 * u; x.stroke(); icon(x, IC.check, 0, 0, 1.2 * r * u, "#141414", { lw: 3.2 }); x.restore(); }
function numBadge(x, c, u, X, Y, n, s = 1) { if (s <= 0) return; x.save(); x.translate(X, Y); x.scale(s, s); x.fillStyle = c.signal; x.beginPath(); x.arc(0, 0, 1 * u, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = .18 * u; x.stroke(); txt(x, String(n), 0, .05 * u, 1 * u, "#141414", "center", 700); x.restore(); }
function pill(x, c, u, cx, cy, label, { fill = c.glass, ink = c.text, px = 1.1, ic = null, glass = true, h = 3.4 } = {}) { const w = tw(x, label, px * u) + (ic ? 4.6 : 3.2) * u, H = h * u; if (glass) glassFill(x, c, u, cx - w / 2, cy - H / 2, w, H, H * .42, fill); else { x.fillStyle = fill; rr(x, cx - w / 2, cy - H / 2, w, H, H * .42); x.fill(); } if (ic) icon(x, ic, cx - w / 2 + 1.7 * u, cy, 1.3 * u, ink, { lw: 2.4 }); txt(x, label, cx - w / 2 + (ic ? 3 : 1.6) * u, cy, px * u, ink, "left"); return w; }
const R2 = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
const roll2 = (x, a, b, X, Y, px, col, q, al = "center") => { if (q < 1) { x.save(); x.globalAlpha *= 1 - q; txt(x, a, X, Y - eo(q) * px * .8, px, col, al); x.restore(); } x.save(); x.globalAlpha *= q; txt(x, b, X, Y + (1 - eo(q)) * px * .8, px, col, al); x.restore(); };
IC.bag = "M5 8h14l-1.2 12H6.2z M9 8V6.5a3 3 0 0 1 6 0V8"; IC.trash = "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"; IC.back = "M15 5l-7 7 7 7"; IC.up = "M12 16V4M7 9l5-5 5 5M5 14v5h14v-5"; IC.doc = "M6 3h8l4 4v14H6z M14 3v4h4"; IC.star = "M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z";
IC.tabs = "M8 8h12v12H8z M4 16V4h12"; IC.minus = "M6 12h12"; IC.live = "M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M12 5.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z";

/* round 16 helpers */
IC.search = "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M15.5 15.5L20 20"; IC.archive = "M3.5 5h17v4h-17z M5 9v10.5h14V9 M10 13h4"; IC.mail = "M3.5 6h17v12h-17z M3.5 6.5l8.5 6.5 8.5-6.5"; IC.expand = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"; IC.chev = "M6 15l6-6 6 6"; IC.plus = "M12 5v14M5 12h14";
const loopFade = (lt, T, w = .3) => lt > T ? (lt < T + w ? [1 - seg(lt, T, T + w), lt] : [seg(lt, T + w, T + 2 * w), 0]) : [1, lt];
const lines = (x, arr, X, Y, step, px, col, al = "left") => arr.forEach((s, i) => txt(x, s, X, Y + i * step, px, col, al));

/* ---------- house sample art: flat Pop prints ---------- */
const POP = { blue: "#2e8bff", yellow: "#ffc21a", teal: "#00c4a7", pink: "#ff005c", orange: "#ff8a1f", red: "#ff0000", ink: "#141414", paper: "#f4f3ef" };
const PRINTS = ["Sunrise", "Lake", "Pines", "Waves", "Dunes", "Night", "Bloom", "Kite"];
const PH = new Map();
function photo(w, h, seed) {
  w = Math.round(w); h = Math.round(h); const key = w + "x" + h + ":" + seed; if (PH.has(key)) return PH.get(key);
  const [c, x] = mkc(w, h), m = Math.min(w, h), k = seed % 8, P = POP;
  const circ = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  const bg = col => { x.fillStyle = col; x.fillRect(0, 0, w, h); };
  if (k === 0) { bg(P.orange); circ(w * .5, h * .64, m * .34, P.yellow); x.fillStyle = P.pink; [[.66, .035], [.74, .05], [.83, .07]].forEach(([y, t]) => x.fillRect(0, h * y, w, h * t)); x.fillRect(0, h * .93, w, h * .07); }
  else if (k === 1) { bg(P.blue); circ(w * .7, h * .32, m * .13, P.yellow); x.fillStyle = P.teal; x.fillRect(0, h * .6, w, h * .4); x.strokeStyle = P.paper; x.lineCap = "round"; x.lineWidth = Math.max(1, m * .025); [[.2, .72, .22], [.55, .8, .28], [.3, .9, .18]].forEach(([a, b, l]) => { x.beginPath(); x.moveTo(w * a, h * b); x.lineTo(w * (a + l), h * b); x.stroke(); }); }
  else if (k === 2) { bg(P.teal); circ(w * .3, h * .32, m * .17, P.pink); x.fillStyle = P.ink; const n = Math.max(4, Math.round(w / m * 5)); for (let i = 0; i < n; i++) { const cx = (i + .5) / n * w, th = h * (.34 + ((i * 37) % 5) / 5 * .2), bw = w / n * .62; x.beginPath(); x.moveTo(cx, h - th); x.lineTo(cx + bw, h); x.lineTo(cx - bw, h); x.closePath(); x.fill(); } }
  else if (k === 3) { bg(P.pink); circ(w * .72, h * .3, m * .16, P.yellow); [P.blue, P.teal].forEach((col, j) => { const r = m * .1, y = h * (.62 + j * .16); x.fillStyle = col; x.beginPath(); x.moveTo(-r * 3, h); x.lineTo(-r * 3, y + r); for (let cx = -r * 2 + j * r; cx < w + r * 3; cx += r * 2) x.arc(cx, y + r, r, Math.PI, 0); x.lineTo(w + r * 3, h); x.closePath(); x.fill(); }); }
  else if (k === 4) { bg(P.yellow); circ(w * .66, h * .3, m * .1, P.red); circ(w * .18, h + m * .25, m * .62, P.orange); circ(w * .9, h + m * .38, m * .6, P.pink); }
  else if (k === 5) { bg(P.ink); circ(w * .62, h * .38, m * .22, P.blue); circ(w * .62 + m * .1, h * .38 - m * .06, m * .2, P.ink); x.fillStyle = P.paper; [[.2, .2], [.3, .6], [.15, .45], [.85, .75], [.42, .15], [.8, .18]].forEach(([a, b]) => { x.beginPath(); x.arc(w * a, h * b, Math.max(.8, m * .012), 0, 7); x.fill(); }); x.fillStyle = P.teal; x.fillRect(0, h * .84, w, h * .16); }
  else if (k === 6) { bg(P.blue); const cx = w * .5, cy = h * .5, r = m * .14; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; circ(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25, r, P.pink); } circ(cx, cy, r * .9, P.yellow); }
  else { bg(P.orange); const cx = w * .56, cy = h * .4, s = m * .24; x.fillStyle = P.teal; x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s * .7, cy); x.lineTo(cx, cy + s * 1.2); x.lineTo(cx - s * .7, cy); x.closePath(); x.fill(); x.fillStyle = P.ink; x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx, cy + s * 1.2); x.lineTo(cx + s * .7, cy); x.closePath(); x.globalAlpha = .18; x.fill(); x.globalAlpha = 1; x.strokeStyle = P.ink; x.lineWidth = Math.max(1, m * .012); x.beginPath(); x.moveTo(cx, cy + s * 1.2); x.bezierCurveTo(cx - s, cy + s * 2, cx + s * .4, h * .85, w * .2, h * 1.02); x.stroke(); [[.2, .3], [.45, .6]].forEach(([a, b]) => { x.fillStyle = P.yellow; x.beginPath(); const px = cx - s * a * 2, py = cy + s * 1.2 + s * b; x.moveTo(px, py); x.lineTo(px - s * .18, py - s * .1); x.lineTo(px - s * .18, py + s * .1); x.fill(); }); }
  PH.set(key, c); return c;
}
const sm = (a, b, x) => { const p = Math.max(0, Math.min(1, (x - a) / (b - a))); return p * p * (3 - 2 * p); };
const easeIO = p => p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
IC.mic = "M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3z M6 11a6 6 0 0 0 12 0 M12 17v3.5";
export const SK = {};

/* 155 Snapshot */
SK.Snapshot = [6.6, ({ x, S, u, lt, c, touch, mem }) => {
  const w = 20 * u, h = 13 * u, X = (S - w) / 2, Y = (S - h) / 2 - 2 * u, R = 2 * u, key = c.glass + c.text;
  if (mem.key !== key) {
    mem.key = key; const [cc, cx] = mkc(w, h); cx.fillStyle = c.glass; rr(cx, 0, 0, w, h, R); cx.fill();
    txt(cx, "Morning run", 1.6 * u, 2.2 * u, 1.1 * u, c.muted, "left"); txt(cx, "5.20 km", 1.6 * u, 5 * u, 3.2 * u, c.text, "left");
    ["28:14", "5'26\"/km", "412 kcal"].forEach((s, i) => txt(cx, s, 1.6 * u + i * 5.6 * u, 9.4 * u, 1.1 * u, c.text, "left")); ["Time", "Pace", "Energy"].forEach((s, i) => txt(cx, s, 1.6 * u + i * 5.6 * u, 11 * u, .9 * u, c.muted, "left"));
    cx.strokeStyle = c.signal; cx.lineWidth = .3 * u; cx.lineCap = cx.lineJoin = "round"; cx.beginPath(); [[13, 6.5], [14.2, 4.6], [15.6, 5.4], [16.4, 3.2], [17.6, 4], [18.4, 2.4]].forEach(([a, b], i) => i ? cx.lineTo(a * u, b * u) : cx.moveTo(a * u, b * u)); cx.stroke();
    cx.fillStyle = c.signal; cx.beginPath(); cx.arc(18.4 * u, 2.4 * u, .4 * u, 0, 7); cx.fill(); mem.card = cc;
  }
  x.save(); x.shadowColor = c.shadow; x.shadowBlur = 1.4 * u; x.shadowOffsetY = .5 * u; x.drawImage(mem.card, X, Y); x.restore();
  const bx = X + w * .62, by = Y + h * .55;
  const T = 1.1, out = seg(lt, 5.2, 5.8);
  if (lt > T && lt < 5.8) {
    const fl = 1 - seg(lt, T, T + .45); if (fl > 0) { x.save(); x.globalAlpha = fl; x.fillStyle = "#fff"; rr(x, X, Y, w, h, R); x.fill(); x.restore(); }
    const q = spr(lt - T - .25, 6, 10), sc = lerp(1, .34, q), tx = lerp(X + w / 2, X + 3.4 * u, q) - out * 8 * u, ty = lerp(Y + h / 2, S - 5.6 * u, q), ro = lerp(0, -5, clamp(q)) * Math.PI / 180;
    x.save(); x.globalAlpha = 1 - out; x.translate(tx, ty); x.rotate(ro); x.scale(sc, sc); const bd = .8 * u / sc * .5;
    x.shadowColor = "rgba(0,0,0,.28)"; x.shadowBlur = 2 * u; x.shadowOffsetY = .8 * u; x.fillStyle = "#fff"; rr(x, -w / 2 - bd, -h / 2 - bd, w + bd * 2, h + bd * 2, R + bd); x.fill(); x.shadowColor = "transparent";
    x.drawImage(mem.card, -w / 2, -h / 2); if (fl > 0) { x.globalAlpha = fl * (1 - out); x.fillStyle = "#fff"; rr(x, -w / 2, -h / 2, w, h, R); x.fill(); } x.restore();
    const pa = clamp(spr(lt - T - .75, 8, 12)) * (1 - out); if (pa > 0 && lt > T + .75) { x.save(); x.globalAlpha = clamp(pa); const pw = 11.6 * u, ph = 3.2 * u, px = X + 6.6 * u + (1 - pa) * -2 * u, py = S - 5.6 * u - ph / 2; glassFill(x, c, u, px, py, pw, ph, ph * .42); x.fillStyle = c.signal; x.beginPath(); x.arc(px + 1.6 * u, py + ph / 2, .9 * u, 0, 7); x.fill(); icon(x, IC.check, px + 1.6 * u, py + ph / 2, 1.1 * u, "#141414", { lw: 3 }); txt(x, "Saved to Photos", px + 3 * u, py + ph / 2, 1.05 * u, c.text, "left"); x.restore(); }
  }
  touch(bx, by, lt > T - .2 && lt < T + .02);
}];

/* 208 Map Expand */
SK.MapExpand = [7.6, ({ x, S, u, lt, c, touch, mem }) => {
  // Closed: a place card in a list with a map thumbnail. Open: the map fills the stage, the card floats down onto
  // it as liquid glass, and the actions bud out of the card into a joined glass bar, with a neck while they leave.
  const key = c.glass + c.page + S; if (mem.key !== key) { mem.key = key; const L = c.dark;
    const M = 36 * u, [mc, m] = mkc(M, M), R = mulberry(7), pal = L ? { land: "#1c1c1c", park: "#0f3a33", water: "#12305a", road: "#343434", edge: "#262626", minor: "#2a2a2a" } : { land: "#f4f3ef", park: "#bfeee6", water: "#b3d6ff", road: "#ffffff", edge: "#e3e1db", minor: "#fbfaf7" };
    m.fillStyle = pal.land; m.fillRect(0, 0, M, M); m.fillStyle = pal.water; m.beginPath(); m.moveTo(0, M * .62); m.bezierCurveTo(M * .3, M * .55, M * .45, M * .8, M * .7, M * .74); m.bezierCurveTo(M * .85, M * .7, M, M * .78, M, M * .8); m.lineTo(M, M); m.lineTo(0, M); m.fill();
    m.fillStyle = pal.park; [[.2, .25, .12], [.78, .3, .09], [.55, .5, .06]].forEach(([a, b, r]) => { m.beginPath(); m.ellipse(a * M, b * M, r * M * 1.3, r * M, .3, 0, 7); m.fill(); });
    const road = (pts, w, col, ec) => { m.lineCap = m.lineJoin = "round"; m.strokeStyle = ec; m.lineWidth = w + .25 * u; m.beginPath(); pts.forEach(([a, b], i) => i ? m.lineTo(a * M, b * M) : m.moveTo(a * M, b * M)); m.stroke(); m.strokeStyle = col; m.lineWidth = w; m.stroke(); };
    for (let i = 0; i < 9; i++) road([[R() * .2, i / 8 + R() * .05], [1, i / 8 + R() * .08 - .04]], .3 * u, pal.minor, pal.edge); for (let i = 0; i < 9; i++) road([[i / 8 + R() * .04, 0], [i / 8 - .06 + R() * .05, .7]], .3 * u, pal.minor, pal.edge);
    road([[0, .42], [.35, .46], [.6, .4], [1, .45]], .7 * u, pal.road, pal.edge); road([[.45, 0], [.5, .3], [.52, .6]], .7 * u, pal.road, pal.edge); mem.map = mc;
    [mem.gm, mem.gx] = mkc(S, S); [mem.go, mem.gox] = mkc(S, S); }
  const T1 = 1, T2 = 5.4, e = lt < T2 ? spr(lt - T1, 5.5, 8.5) : 1 - spr(lt - T2 - .05, 6.5, 10), ec = clamp(e), X = S / 2 - 12 * u, cy = S / 2 - 1 * u;
  // The list under the card fades while the map is open.
  x.globalAlpha = 1 - ec; txt(x, "Nearby", X, S / 2 - 10.8 * u, 1.7 * u, c.text, "left"); [["Old boathouse", "0.9 mi"], ["Pine Lodge", "1.4 mi"]].forEach(([a, b], i) => { const y = S / 2 + 9 * u + i * 4.4 * u; glassFill(x, c, u, X, y, 24 * u, 3.8 * u, 1.5 * u); txt(x, a, X + 1.4 * u, y + 1.9 * u, 1.1 * u, c.text, "left"); txt(x, b, X + 22.6 * u, y + 1.9 * u, 1 * u, c.muted, "right"); }); x.globalAlpha = 1;
  const MO = [S / 2 - 13 * u, S / 2 - 14.6 * u, 26 * u, 29.2 * u], bh = 3.8 * u, gap = 1.7 * u, jn = .32 * u;
  const cardO = [MO[0] + .9 * u, MO[1] + MO[3] - .9 * u - bh - gap - 6.6 * u, MO[2] - 1.8 * u, 6.6 * u], cardC = [X, cy - 4.5 * u, 24 * u, 9 * u];
  const card = R2(cardC, cardO, e), mr = R2([X + .7 * u, cardC[1] + .7 * u, 7.6 * u, 7.6 * u], MO, e), MS = mem.map.width, sc = 1.15;
  if (ec < 1) { x.save(); x.globalAlpha = 1 - ec; glassFill(x, c, u, card[0], card[1], card[2], card[3], 1.8 * u); x.restore(); }
  if (ec > 0) { x.save(); x.globalAlpha = ec; sh(x, c, u, mr[0], mr[1], mr[2], mr[3], lerp(1.2, 2.2, ec) * u, 1.4); x.restore(); }
  x.save(); rr(x, mr[0], mr[1], mr[2], mr[3], lerp(1.2, 2.2, ec) * u); x.clip(); const sw = mr[2] * sc, shh = mr[3] * sc; x.drawImage(mem.map, MS / 2 - sw / 2, MS / 2 - shh / 2 + (MS * .04), sw, shh, mr[0], mr[1], mr[2], mr[3]); x.restore();
  const px = mr[0] + mr[2] / 2, py = mr[1] + mr[3] * lerp(.5, .4, ec) + 1 * u * (1 - ec), drop = lt > T1 && lt < T2 ? (1 - clamp(spr(lt - T1 - .25, 7, 12), 0, 1.2)) * 4 * u : 0, ps = lerp(.65, 1.05, ec);
  x.save(); x.globalAlpha = .25; x.fillStyle = "#000"; x.beginPath(); x.ellipse(px, py, ps * .9 * u * (1 - drop / (8 * u)), ps * .35 * u, 0, 0, 7); x.fill(); x.restore();
  x.save(); x.translate(px, py - drop); x.scale(ps, ps); x.fillStyle = c.signal; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-.6 * u, -1.4 * u, -1.6 * u, -2 * u, -1.6 * u, -3.2 * u); x.arc(0, -3.2 * u, 1.6 * u, Math.PI, 0); x.bezierCurveTo(1.6 * u, -2 * u, .6 * u, -1.4 * u, 0, 0); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = .2 * u; x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(0, -3.2 * u, .6 * u, 0, 7); x.fill(); x.restore();
  // The actions: Directions wide and red, Call and Website square, joined. Each buds out of the card's centre.
  const pw = cardO[2] - 2 * (bh + jn), rest = [[cardO[0], pw], [cardO[0] + pw + jn, bh], [cardO[0] + pw + jn * 2 + bh, bh]], by = cardO[1] + cardO[3] + gap;
  const tb = T1 + .5, acts = rest.map(([ax, aw], k) => { const b = lt < T2 ? spr(lt - tb - k * .08, 7.5, 7.5) : clamp(1 - seg(lt, T2, T2 + .28)), s = lerp(.72, 1, b), hx = card[0] + card[2] / 2, hy = card[1] + card[3] / 2, w = aw * s, h = bh * s, cx = lerp(hx, ax + aw / 2, b), cyy = lerp(hy, by + bh / 2, b); return [cx - w / 2, cyy - h / 2, w, h, b]; });
  if (ec > .01) {
    // Liquid glass that merges: draw the shapes solid, blur, then cut at half alpha, so close shapes join by a neck.
    const g = mem.gx, o = mem.gox; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.filter = `blur(${(1.05 * u).toFixed(1)}px)`; g.fillStyle = "#fff";
    rr(g, card[0], card[1], card[2], card[3], 1.8 * u); g.fill(); acts.forEach(([ax, ay, aw, ah, b]) => { if (b > .001) { rr(g, ax, ay, aw, ah, ah * .42); g.fill(); } }); g.filter = "none";
    const x0 = Math.max(0, Math.floor(card[0] - 2 * u)), y0 = Math.max(0, Math.floor(Math.min(card[1], by) - 2 * u)), x1 = Math.min(S, Math.ceil(card[0] + card[2] + 2 * u)), y1 = Math.min(S, Math.ceil(Math.max(card[1] + card[3], by + bh) + 2 * u)), W = x1 - x0, H = y1 - y0;
    if (W > 0 && H > 0) { const id = g.getImageData(x0, y0, W, H), d = id.data, [gr, gg, gb, ga] = c.dark ? [44, 44, 44, .7] : [255, 255, 255, .7];
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3], t = Math.min(1, Math.max(0, (a - 104) / 44)); d[i] = gr; d[i + 1] = gg; d[i + 2] = gb; d[i + 3] = t * t * (3 - 2 * t) * 255 * ga; }
      o.clearRect(0, 0, S, S); o.putImageData(id, x0, y0);
      x.save(); x.globalAlpha = ec; x.shadowColor = c.dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.14)"; x.shadowBlur = 1.8 * u; x.shadowOffsetY = .7 * u; x.drawImage(mem.go, 0, 0); x.restore(); }
    x.save(); x.globalAlpha = ec; x.strokeStyle = c.dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)"; x.lineWidth = .1 * u; rr(x, card[0] + .05 * u, card[1] + .05 * u, card[2] - .1 * u, card[3] - .1 * u, 1.75 * u); x.stroke(); x.restore();
    acts.forEach(([ax, ay, aw, ah, b], k) => { if (b <= .45) return; x.save(); x.globalAlpha = ec * clamp((b - .45) * 2.6); const mid = [ax + aw / 2, ay + ah / 2];
      if (k === 0) { x.fillStyle = c.signal; rr(x, ax + .12 * u, ay + .12 * u, aw - .24 * u, ah - .24 * u, ah * .42 - .12 * u); x.fill(); const s = aw / pw; x.translate(mid[0], mid[1]); x.scale(s, s); icon(x, "M12 2.8l9.2 9.2-9.2 9.2-9.2-9.2z M9 14.5v-3h5M12.5 9l2 2-2 2", -4.2 * u, 0, 1.6 * u, "#141414", { lw: 2.2 }); txt(x, "Directions", .9 * u, 0, 1.1 * u, "#141414"); }
      else { x.strokeStyle = c.dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)"; x.lineWidth = .1 * u; rr(x, ax + .05 * u, ay + .05 * u, aw - .1 * u, ah - .1 * u, ah * .42); x.stroke(); icon(x, k === 1 ? IC.phone : "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c2.6 2.6 3.6 5.6 3.6 9s-1 6.4-3.6 9c-2.6-2.6-3.6-5.6-3.6-9s1-6.4 3.6-9z", mid[0], mid[1], 1.55 * u * (aw / bh), c.text, { lw: 2 }); }
      x.restore(); });
    x.save(); x.globalAlpha = clamp(ec * 1.4 - .4); liquid(x, c, u, MO[0] + 1 * u, MO[1] + 1 * u, 3.2 * u, 3.2 * u, 1.6 * u); icon(x, IC.back, MO[0] + 2.55 * u, MO[1] + 2.6 * u, 1.5 * u, c.text, { lw: 2.4 }); x.restore();
  }
  const tp = R2([X + 9.6 * u, cardC[1] + 3.2 * u], [card[0] + 1.6 * u, card[1] + 2.5 * u], e); txt(x, "Harbor Inn", tp[0], tp[1], lerp(1.2, 1.55, ec) * u, c.text, "left"); txt(x, "0.4 mi · Open until 22:00", tp[0], tp[1] + lerp(1.8, 2.1, ec) * u, 1 * u, c.muted, "left");
  touch(lt < 3 ? S / 2 : MO[0] + 2.6 * u, lt < 3 ? cardC[1] + 4.5 * u : MO[1] + 2.6 * u, (lt > T1 - .2 && lt < T1) || (lt > T2 - .2 && lt < T2));
}];

/* Spoiler */
const hrand = (i, k) => { let a = (i * 1000003 + k * 7919) | 0; a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; };
const fold = (v, L) => { const p = L * 2; let m = v % p; if (m < 0) m += p; return m > L ? p - m : m; };

