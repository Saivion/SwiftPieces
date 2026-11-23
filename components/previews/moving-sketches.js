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
/* 153 Photo Stack */
SK.PhotoStack = [6.6, ({ x, S, u, lt, c, touch }) => {
  const cx = S / 2, cy = S / 2 - .6 * u, st = 9.4 * u, gs = 10.6 * u, gap = .6 * u;
  const rot = [-9, 7, -4, 0], off = [[-.7, .5], [.6, -.4], [.2, .6], [0, 0]], grid = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const tw2 = gs * 2 + gap;
  for (let i = 0; i < 4; i++) {
    const q = lt < 4.0 ? spr(lt - 1.05 - i * .05, 6.5, 11) : 1 - spr(lt - 4.05 - (3 - i) * .045, 7, 12);
    const px = lerp(cx + off[i][0] * u, cx + grid[i][0] * (gs + gap) / 2, q), py = lerp(cy + off[i][1] * u, cy + grid[i][1] * (gs + gap) / 2, q), sz = lerp(st, gs, q), ro = lerp(rot[i], 0, clamp(q)) * Math.PI / 180;
    x.save(); x.translate(px, py); x.rotate(ro); drawPhoto(x, photo(gs, gs, [3, 5, 2, 0][i]), -sz / 2, -sz / 2, sz, sz, 1.4 * u, { shadow: c.shadow, u }); x.restore();
  }
  const q0 = lt < 4.0 ? clamp(spr(lt - 1.05, 6.5, 11)) : clamp(1 - spr(lt - 4.05, 7, 12));
  txt(x, "4 photos", cx, lerp(cy + st / 2 + 2.2 * u, cy + tw2 / 2 + 1.8 * u, q0), 1.1 * u, c.muted);
  touch(cx + 1 * u, cy + 1 * u, (lt > .85 && lt < 1.05) || (lt > 3.85 && lt < 4.05));
}];

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
  const bx = X + w - 2.4 * u, by = Y + h + 3 * u; x.fillStyle = c.trough; x.beginPath(); x.arc(bx, by, 2 * u, 0, 7); x.fill(); icon(x, IC.share, bx, by - .05 * u, 1.8 * u, c.text, { lw: 2 });
  txt(x, "Share as image", bx - 2.8 * u, by, 1.05 * u, c.muted, "right");
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
/* 181 Genie Delete */
SK.GenieDelete = [6.8, ({ x, S, u, lt, c, touch, mem }) => {
  const W = 18 * u, H = 12.5 * u, X = (S - W) / 2, Y = S / 2 - 11 * u, tX = S / 2, tY = S / 2 + 10 * u, key = c.glass + c.text;
  if (mem.key !== key) { mem.key = key; const [cv, cx] = mkc(W, H); cx.fillStyle = c.glass; rr(cx, 0, 0, W, H, 1.8 * u); cx.fill(); txt(cx, "Packing list", 1.5 * u, 2.2 * u, 1.3 * u, c.text, "left"); ["Tent and stakes", "Two sleeping bags", "Kayak paddles", "Sunscreen"].forEach((s, i) => { cx.fillStyle = c.dot; cx.beginPath(); cx.arc(1.9 * u, (4.8 + i * 2) * u, .35 * u, 0, 7); cx.fill(); txt(cx, s, 2.9 * u, (4.8 + i * 2) * u, 1.05 * u, c.muted, "left"); }); mem.cv = cv; }
  const p = lt < 4.2 ? easeIO(seg(lt, 1.1, 1.8)) : 1 - easeIO(seg(lt, 4.3, 5.0));
  if (p <= 0) { x.save(); x.shadowColor = c.shadow; x.shadowBlur = 1.4 * u; x.shadowOffsetY = .5 * u; x.drawImage(mem.cv, X, Y); x.restore(); }
  else if (p < 1) {
    const N = 90, rh = H / N;
    for (let r = 0; r < N; r++) {
      const v = r / N, f = sm(0, 1, clamp(p * 1.75 - (1 - v) * .75)), gy = clamp(p * 1.5 - (1 - v) * .5) ** 2;
      const w = lerp(W, 1.4 * u, f), cx = lerp(X + W / 2, tX, f), y = lerp(Y + r * rh, tY - 1.4 * u + v * 1.2 * u, gy);
      x.globalAlpha = 1 - sm(.85, 1, p); x.drawImage(mem.cv, 0, r * rh * mem.cv.width / W, mem.cv.width, Math.ceil(rh * mem.cv.width / W) + 1, cx - w / 2, y, w, rh + 1.2);
    }
    x.globalAlpha = 1;
  }
  const tb = lt > 1.8 && lt < 4 ? 1 + .25 * bump(lt - 1.8) : 1, pr = lt > .85 && lt < 1.05 ? .92 : 1;
  x.save(); x.translate(tX, tY); x.scale(tb * pr, tb * pr); glassFill(x, c, u, -2.2 * u, -2.2 * u, 4.4 * u, 4.4 * u, 2.2 * u); icon(x, IC.trash, 0, 0, 2 * u, c.text, { lw: 2 }); x.restore();
  const pa = lt > 1.9 && lt < 4.4 ? clamp(spr(lt - 1.9, 8, 12), 0, 1.1) * (1 - seg(lt, 4.15, 4.4)) : 0;
  if (pa > 0) { x.save(); x.globalAlpha = clamp(pa); x.translate(S / 2, tY - 5 * u); x.scale(.8 + .2 * pa, .8 + .2 * pa); const w = 17 * u; glassFill(x, c, u, -w / 2, -1.7 * u, w, 3.4 * u, 1.4 * u); txt(x, "Note deleted", -w / 2 + 1.4 * u, 0, 1.05 * u, c.text, "left"); txt(x, "Undo", w / 2 - 1.4 * u, 0, 1.05 * u, c.signal, "right"); x.restore(); }
  touch(tX, tY, lt > .85 && lt < 1.05); if (lt > 3.95 && lt < 4.15) touch(S / 2 + 7 * u, tY - 5 * u, true);
}];

/* 182 Mini Player */
SK.MiniPlayer = [7.4, ({ x, S, u, lt, c, touch }) => {
  const E = [S / 2 - 12 * u, S / 2 - 10.5 * u, 24 * u, 13.5 * u], PR = [S / 2 + 12.5 * u - 9.6 * u, S / 2 + 12 * u - 5.4 * u, 9.6 * u, 5.4 * u], PL = [S / 2 - 12.5 * u, PR[1], 9.6 * u, 5.4 * u];
  const mid = [E[0] + 2 * u, E[1] + 5 * u, E[2] * .7, E[3] * .7], fl = [PR[0] - 6 * u, PR[1] - .6 * u, PR[2], PR[3]];
  let r; if (lt < 1) r = E; else if (lt < 1.6) r = R2(E, mid, eo(seg(lt, 1, 1.6))); else if (lt < 3) r = R2(mid, PR, spr(lt - 1.6, 6, 9)); else if (lt < 3.3) r = R2(PR, fl, eo(seg(lt, 3, 3.3))); else if (lt < 5.4) r = R2(fl, PL, spr(lt - 3.3, 5, 8)); else r = R2(PL, E, spr(lt - 5.45, 6, 9));
  const mini = clamp(1 - (r[2] - PR[2]) / (E[2] - PR[2]));
  if ((lt > 1 && lt < 2) || (lt > 3 && lt < 3.8)) { x.save(); x.globalAlpha = .7; x.setLineDash([.5 * u, .4 * u]); x.strokeStyle = c.subtle; x.lineWidth = .12 * u; [PR, PL].forEach(q => { rr(x, q[0], q[1], q[2], q[3], 1 * u); x.stroke(); }); x.restore(); }
  const ia = 1 - clamp(mini * 2.2); if (ia > 0) { x.globalAlpha = ia; txt(x, "Lake Ida · Episode 3", E[0] + .2 * u, E[1] + E[3] + 2 * u, 1.2 * u, c.text, "left"); txt(x, "Weekend Trails · 24 min", E[0] + .2 * u, E[1] + E[3] + 3.8 * u, 1 * u, c.muted, "left"); x.globalAlpha = 1; }
  sh(x, c, u, r[0], r[1], r[2], r[3], lerp(1.6 * u, 1 * u, mini), 1 + mini); cover(x, photo(E[2], E[3], 2), r[0], r[1], r[2], r[3], lerp(1.6 * u, 1 * u, mini));
  x.save(); rr(x, r[0], r[1], r[2], r[3], lerp(1.6 * u, 1 * u, mini)); x.clip(); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(r[0], r[1] + r[3] - .3 * u, r[2], .3 * u); x.fillStyle = "#fff"; x.fillRect(r[0], r[1] + r[3] - .3 * u, r[2] * .38, .3 * u); x.restore();
  const ps = lerp(2.6, 1.6, mini) * u; x.fillStyle = "rgba(0,0,0,.28)"; x.beginPath(); x.arc(r[0] + r[2] / 2, r[1] + r[3] / 2, ps, 0, 7); x.fill(); icon(x, IC.play, r[0] + r[2] / 2 + .1 * u, r[1] + r[3] / 2, ps * .95, null, { fill: "#fff" });
  const fx = r[0] + r[2] / 2, fy = r[1] + r[3] / 2; touch(fx, fy, (lt > .85 && lt < 1.6) || (lt > 2.85 && lt < 3.3) || (lt > 5.25 && lt < 5.45));
}];

/* 193 Album Open */
SK.AlbumOpen = [7.2, ({ x, S, u, lt, c, touch }) => {
  const as = 8.6 * u, ag = 3.4 * u, ax0 = S / 2 - as - ag / 2, ay0 = S / 2 - as - 1.6 * u, alb = i => [ax0 + (i % 2) * (as + ag), ay0 + Math.floor(i / 2) * (as + ag + 1.2 * u)];
  const names = ["Lake trip", "Tokyo", "Family", "Recipes"], T1 = 1.0, T2 = 4.6;
  const o = lt < T2 ? spr(lt - T1 - .05, 6.5, 10) : 1 - spr(lt - T2 - .05, 7, 11), oc = clamp(o);
  for (let i = 1; i < 4; i++) { const [X, Y] = alb(i); x.save(); x.globalAlpha = 1 - oc; const s = 1 - .15 * oc; x.translate(X + as / 2, Y + as / 2); x.scale(s, s); [-6, 5, 0].forEach((r, k) => { x.save(); x.rotate(r * Math.PI / 180); sh(x, c, u, -as / 2, -as / 2, as, as, 1 * u); cover(x, photo(as, as, (i * 3 + k) % 8), -as / 2, -as / 2, as, as, 1 * u); x.restore(); }); x.restore(); x.globalAlpha = 1 - oc; txt(x, names[i], X + as / 2, Y + as + 1.6 * u, 1.05 * u, c.text); x.globalAlpha = 1; }
  const gs = 7 * u, gg = .5 * u, gx0 = (S - 3 * gs - 2 * gg) / 2, gy0 = S / 2 - 9 * u, [A0x, A0y] = alb(0);
  for (let k = 8; k >= 0; k--) {
    const q = lt < T2 ? spr(lt - T1 - .05 - k * .02, 6.5, 10) : 1 - spr(lt - T2 - .05 - (8 - k) * .015, 7, 11), qc = clamp(q);
    const from = [A0x + as / 2, A0y + as / 2, k < 3 ? as : as * .9], to = [gx0 + (k % 3) * (gs + gg) + gs / 2, gy0 + Math.floor(k / 3) * (gs + gg) + gs / 2, gs], r = R2(from, to, q), ro = k < 3 ? [-6, 5, 0][k] * (1 - qc) : 0;
    if (k >= 3 && qc <= .02) continue; x.save(); x.globalAlpha = k < 3 ? 1 : qc; x.translate(r[0], r[1]); x.rotate(ro * Math.PI / 180); sh(x, c, u, -r[2] / 2, -r[2] / 2, r[2], r[2], lerp(1, .6, qc) * u); cover(x, photo(gs * 1.3, gs * 1.3, k % 8), -r[2] / 2, -r[2] / 2, r[2], r[2], lerp(1, .6, qc) * u); x.restore();
  }
  x.globalAlpha = 1 - oc; txt(x, names[0], A0x + as / 2, A0y + as + 1.6 * u, 1.05 * u, c.text); x.globalAlpha = oc; icon(x, IC.back, gx0 + .6 * u, gy0 - 2.6 * u, 1.6 * u, c.text, { lw: 2.4 }); txt(x, "Lake trip", gx0 + 2 * u, gy0 - 2.6 * u, 1.4 * u, c.text, "left"); txt(x, "9 photos", gx0 + 3 * gs + 2 * gg, gy0 - 2.6 * u, 1 * u, c.muted, "right"); x.globalAlpha = 1;
  touch(lt < 2 ? A0x + as / 2 : gx0 + .6 * u, lt < 2 ? A0y + as / 2 : gy0 - 2.6 * u, (lt > T1 - .2 && lt < T1) || (lt > T2 - .2 && lt < T2));
}];

/* 195 Stacking Scroll */
SK.StackingScroll = [7.2, ({ x, S, u, lt, c, touch }) => {
  const rows = [["Ferry to Lake Ida", "Sat 9:00", "#2e8bff"], ["Lodge check-in", "Sat 15:00", "#00c4a7"], ["Kayak rental", "Sun 10:00", "#ffc21a"], ["Trail permit", "Sun", "#ff005c"], ["Harbor dinner", "Sun 19:30", "#ff8a1f"], ["Ferry home", "Mon 8:00", "#ffc21a"], ["Parking", "Mon", "#2e8bff"]];
  const W = 25 * u, X = (S - W) / 2, rh = 5 * u, step = 5.7 * u, top = S / 2 - 7.8 * u;
  const s = lt < 1 ? 0 : lt < 3.2 ? 17 * u * easeIO(seg(lt, 1, 3.2)) : lt < 4.4 ? 17 * u : lt < 6.4 ? 17 * u * (1 - easeIO(seg(lt, 4.4, 6.4))) : 0;
  txt(x, "Passes", X, S / 2 - 11.2 * u, 1.6 * u, c.text, "left");
  x.save(); x.beginPath(); x.rect(0, top - 3 * u, S, S); x.clip();
  rows.forEach(([n, d, col], i) => {
    const ny = top + i * step - s; let y = ny, sc = 1, a = 1;
    if (ny < top) { const dd = (top - ny) / step; y = top - Math.min(dd, 3) * .55 * u; sc = 1 - Math.min(dd, 3) * .045; a = clamp(3.6 - dd); }
    if (a <= 0 || y > S) return;
    x.save(); x.globalAlpha = a; x.translate(S / 2, y + rh / 2); x.scale(sc, sc); glassFill(x, c, u, -W / 2, -rh / 2, W, rh, 1.6 * u); x.fillStyle = col; rr(x, -W / 2, -rh / 2, 1 * u, rh, .5 * u); x.fill();
    txt(x, n, -W / 2 + 2.2 * u, 0, 1.15 * u, c.text, "left"); txt(x, d, W / 2 - 1.4 * u, 0, 1 * u, c.muted, "right"); x.restore();
  });
  x.restore();
  const fy = lt < 3.4 ? S / 2 + 9 * u - (lt > 1 ? 12 * u * easeIO(seg(lt, 1, 3.2)) : 0) : S / 2 - 3 * u + 12 * u * easeIO(seg(lt, 4.4, 6.4)); touch(S / 2 + 6 * u, fy, (lt > .9 && lt < 3.2) || (lt > 4.3 && lt < 6.4));
}];

/* 200 Draft Minimize */
SK.DraftMinimize = [7.2, ({ x, S, u, lt, c, touch }) => {
  const F = [S / 2 - 12.5 * u, S / 2 - 12 * u, 25 * u, 19.5 * u], Pm = [S / 2 - 9 * u, S / 2 + 9 * u, 18 * u, 3.6 * u];
  const drag = lt > 1 && lt < 1.35 ? 2.4 * u * eo(seg(lt, 1, 1.35)) : 0;
  const m = lt < 4.5 ? spr(lt - 1.35, 5.5, 8.5) : 1 - spr(lt - 4.6, 6, 9), mc = clamp(m);
  const X = S / 2 - 12 * u;
  x.globalAlpha = .5 + .5 * mc; txt(x, "Inbox", X, S / 2 - 10.8 * u, 1.7 * u, c.text, "left");
  [["Maya Chen", "Packing list"], ["Harbor Inn", "Your booking"], ["Ferry Co.", "Schedule change"], ["Jonah", "Photos from Sat"]].forEach(([a, b], i) => { const y = S / 2 - 8 * u + i * 4.4 * u; x.fillStyle = c.line; x.fillRect(X, y + 3.6 * u, 24 * u, .1 * u); txt(x, a, X, y + 1 * u, 1.1 * u, c.text, "left"); txt(x, b, X, y + 2.6 * u, 1 * u, c.muted, "left"); });
  x.globalAlpha = 1;
  const r = R2(F, Pm, m); r[1] += drag * (1 - mc); const R = lerp(2.2 * u, Pm[3] * .42, mc);
  x.save(); x.shadowColor = c.shadow; x.shadowBlur = lerp(2.4, 1.2, mc) * u; x.shadowOffsetY = .6 * u; x.fillStyle = c.glass; rr(x, r[0], r[1], r[2], r[3], R); x.fill(); x.restore();
  x.save(); rr(x, r[0], r[1], r[2], r[3], R); x.clip();
  const fa = 1 - clamp(m * 1.8); if (fa > 0) { x.globalAlpha = fa; const ox = r[0] + 1.4 * u, oy = r[1];
    x.fillStyle = c.subtle; rr(x, r[0] + r[2] / 2 - 2 * u, oy + .7 * u, 4 * u, .45 * u, .3 * u); x.fill();
    txt(x, "New message", ox, oy + 3 * u, 1.45 * u, c.text, "left"); x.fillStyle = c.signal; x.beginPath(); x.arc(r[0] + r[2] - 2.6 * u, oy + 3 * u, 1.5 * u, 0, 7); x.fill(); icon(x, IC.arrowUp, r[0] + r[2] - 2.6 * u, oy + 3 * u, 1.6 * u, "#141414", { lw: 2.8 });
    txt(x, "To:", ox, oy + 6.2 * u, 1.05 * u, c.muted, "left"); txt(x, "Maya Chen", ox + 2.4 * u, oy + 6.2 * u, 1.05 * u, c.text, "left"); x.fillStyle = c.line; x.fillRect(ox, oy + 7.6 * u, r[2] - 2.8 * u, .1 * u);
    lines(x, ["Hi Maya, the ferry leaves at 9", "from Gate 3. Can you bring the", "paddles and the sunscreen?"], ox, oy + 9.6 * u, 1.9 * u, 1.1 * u, c.text); }
  const pa = clamp(m * 1.8 - .8); if (pa > 0) { x.globalAlpha = pa; icon(x, IC.doc, r[0] + 1.9 * u, r[1] + r[3] / 2, 1.5 * u, c.text, { lw: 2 }); txt(x, "Hi Maya, the…", r[0] + 3.4 * u, r[1] + r[3] / 2, 1.05 * u, c.text, "left"); icon(x, IC.chev, r[0] + r[2] - 1.8 * u, r[1] + r[3] / 2, 1.4 * u, c.muted, { lw: 2.4 }); }
  x.restore(); x.globalAlpha = 1;
  touch(lt < 3 ? S / 2 : S / 2, lt < 3 ? F[1] + 1 * u + drag : Pm[1] + Pm[3] / 2, (lt > .9 && lt < 1.4) || (lt > 4.35 && lt < 4.55));
}];

/* 204 Avatar Drop */
SK.AvatarDrop = [6.8, ({ x, S, u, lt: T, c, touch }) => {
  const [A, lt] = loopFade(T, 6, .3); x.globalAlpha = A;
  const ac = [S / 2, S / 2 - 7.6 * u], ar = 4 * u, ts = 5.2 * u, gap = .6 * u, gx = S / 2 - 2 * ts - 1.5 * gap, gy = S / 2 + 2.6 * u, pick = 5, seeds = [1, 4, 6, 0, 3, 7, 5, 2];
  const tr = i => [gx + (i % 4) * (ts + gap), gy + Math.floor(i / 4) * (ts + gap), ts, ts];
  const landed = lt > 2.15, ring = seg(lt, 2.15, 2.8);
  x.save(); x.translate(ac[0], ac[1]); const bs = landed ? 1 + .08 * bump(lt - 2.15, 7, 13) : 1; x.scale(bs, bs);
  if (!landed) { x.setLineDash([.55 * u, .45 * u]); x.strokeStyle = c.subtle; x.lineWidth = .16 * u; x.beginPath(); x.arc(0, 0, ar, 0, 7); x.stroke(); x.setLineDash([]); x.fillStyle = c.trough; x.beginPath(); x.arc(0, 0, ar - .4 * u, 0, 7); x.fill(); icon(x, IC.plus, 0, 0, 2.2 * u, c.muted, { lw: 2.2 }); }
  else { x.save(); x.beginPath(); x.arc(0, 0, ar, 0, 7); x.clip(); x.drawImage(photo(8 * u, 8 * u, seeds[pick]), -ar, -ar, 2 * ar, 2 * ar); x.restore(); x.strokeStyle = c.page; x.lineWidth = .3 * u; x.beginPath(); x.arc(0, 0, ar, 0, 7); x.stroke(); }
  x.restore();
  if (ring > 0 && ring < 1) { x.save(); x.globalAlpha = A * (1 - ring); x.strokeStyle = c.signal; x.lineWidth = .3 * u * (1 - ring) + .05 * u; x.beginPath(); x.arc(ac[0], ac[1], ar + 2.2 * u * eo(ring), 0, 7); x.stroke(); x.restore(); }
  txt(x, "Maya Chen", S / 2, S / 2 - 1.8 * u, 1.35 * u, c.text); x.save(); x.globalAlpha = A * (landed ? 1 : 0) * seg(lt, 2.3, 2.7); txt(x, "Looking good", S / 2, S / 2 - .1 * u, 1 * u, c.muted); x.restore();
  for (let i = 0; i < 8; i++) { const r = tr(i); cover(x, photo(ts, ts, seeds[i]), r[0], r[1], r[2], r[3], .8 * u); }
  const f = easeIO(seg(lt, 1.2, 2.15)); if (lt > .95 && lt < 2.15) { const r0 = tr(pick), lift = lt < 1.2 ? spr(lt - .95, 9, 14) * .1 : .1 * (1 - f); const cx = lerp(r0[0] + ts / 2, ac[0], f), cy = lerp(r0[1] + ts / 2, ac[1], f) - 5 * u * Math.sin(Math.PI * f), sz = lerp(ts, 2 * ar, f) * (1 + lift), rad = lerp(.8 * u, sz / 2, eo(f));
    x.save(); x.shadowColor = c.shadow; x.shadowBlur = 2 * u; x.shadowOffsetY = .8 * u; x.fillStyle = "#000"; rr(x, cx - sz / 2, cy - sz / 2, sz, sz, rad); x.fill(); x.restore(); cover(x, photo(8 * u, 8 * u, seeds[pick]), cx - sz / 2, cy - sz / 2, sz, sz, rad); }
  x.globalAlpha = 1; const r0 = tr(pick); touch(r0[0] + ts / 2, r0[1] + ts / 2, lt > .8 && lt < 1.2);
}];

/* 206 Video Rotate */
SK.VideoRotate = [7.2, ({ x, S, u, lt, c, touch }) => {
  const q = lt < 4.6 ? clamp(spr(lt - 1.2, 5, 8), 0, 1.03) : 1 - clamp(spr(lt - 4.7, 5, 8), -.03, 1), qc = clamp(q);
  const DW = 14 * u, DH = 25 * u;
  x.save(); x.translate(S / 2, S / 2); x.rotate(-Math.PI / 2 * q);
  x.save(); x.shadowColor = c.shadow; x.shadowBlur = 2 * u; x.shadowOffsetY = .5 * u; x.fillStyle = c.glass; rr(x, -DW / 2, -DH / 2, DW, DH, 2.4 * u); x.fill(); x.restore();
  x.strokeStyle = c.line; x.lineWidth = .2 * u; rr(x, -DW / 2, -DH / 2, DW, DH, 2.4 * u); x.stroke();
  x.globalAlpha = 1 - clamp(qc * 2.5); const lx = -DW / 2 + 1 * u; txt(x, "Lake Ida · Episode 3", lx, -DH / 2 + 12.6 * u, 1.05 * u, c.text, "left"); txt(x, "Weekend Trails · 24 min", lx, -DH / 2 + 14.2 * u, .9 * u, c.muted, "left");
  for (let i = 0; i < 3; i++) { const y = -DH / 2 + 16.4 * u + i * 2.6 * u; x.fillStyle = c.trough; x.beginPath(); x.arc(lx + .8 * u, y, .8 * u, 0, 7); x.fill(); x.fillStyle = c.line; rr(x, lx + 2.2 * u, y - .35 * u, [8, 6, 7][i] * u, .7 * u, .35 * u); x.fill(); }
  x.globalAlpha = 1; x.restore();
  const vw = lerp(13 * u, DH - 1.6 * u, qc), vh = lerp(7.3 * u, DW - 1 * u, qc), vy = lerp(S / 2 - DH / 2 + 1.8 * u + 3.65 * u, S / 2, q);
  const vx = S / 2 - vw / 2, vt = vy - vh / 2, R = lerp(1, 2.4, qc) * u; cover(x, photo(26 * u, 14.6 * u, 2), vx, vt, vw, vh, R);
  x.save(); rr(x, vx, vt, vw, vh, R); x.clip(); const prog = .3 + .1 * (lt / 7.2); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(vx + 1 * u, vt + vh - 1.3 * u, vw - 2 * u, .3 * u); x.fillStyle = "#fff"; x.fillRect(vx + 1 * u, vt + vh - 1.3 * u, (vw - 2 * u) * prog, .3 * u); x.fillStyle = c.signal; x.beginPath(); x.arc(vx + 1 * u + (vw - 2 * u) * prog, vt + vh - 1.15 * u, .45 * u, 0, 7); x.fill(); x.restore();
  const ix = vx + vw - 1.7 * u, iy = vt + 1.7 * u; icon(x, IC.expand, ix, iy, 1.5 * u, "#fff", { lw: 2.4 });
  touch(ix, iy, (lt > 1 && lt < 1.2) || (lt > 4.5 && lt < 4.7));
}];

/* 208 Map Expand */
SK.MapExpand = [7.2, ({ x, S, u, lt, c, touch, mem }) => {
  const key = c.glass + c.page + S; if (mem.key !== key) { mem.key = key; const L = c.dark;
    const M = 36 * u, [mc, m] = mkc(M, M), R = mulberry(7), pal = L ? { land: "#1c1c1c", park: "#0f3a33", water: "#12305a", road: "#343434", edge: "#262626", minor: "#2a2a2a" } : { land: "#f4f3ef", park: "#bfeee6", water: "#b3d6ff", road: "#ffffff", edge: "#e3e1db", minor: "#fbfaf7" };
    m.fillStyle = pal.land; m.fillRect(0, 0, M, M); m.fillStyle = pal.water; m.beginPath(); m.moveTo(0, M * .62); m.bezierCurveTo(M * .3, M * .55, M * .45, M * .8, M * .7, M * .74); m.bezierCurveTo(M * .85, M * .7, M, M * .78, M, M * .8); m.lineTo(M, M); m.lineTo(0, M); m.fill();
    m.fillStyle = pal.park; [[.2, .25, .12], [.78, .3, .09], [.55, .5, .06]].forEach(([a, b, r]) => { m.beginPath(); m.ellipse(a * M, b * M, r * M * 1.3, r * M, .3, 0, 7); m.fill(); });
    const road = (pts, w, col, ec) => { m.lineCap = m.lineJoin = "round"; m.strokeStyle = ec; m.lineWidth = w + .25 * u; m.beginPath(); pts.forEach(([a, b], i) => i ? m.lineTo(a * M, b * M) : m.moveTo(a * M, b * M)); m.stroke(); m.strokeStyle = col; m.lineWidth = w; m.stroke(); };
    for (let i = 0; i < 9; i++) road([[R() * .2, i / 8 + R() * .05], [1, i / 8 + R() * .08 - .04]], .3 * u, pal.minor, pal.edge); for (let i = 0; i < 9; i++) road([[i / 8 + R() * .04, 0], [i / 8 - .06 + R() * .05, .7]], .3 * u, pal.minor, pal.edge);
    road([[0, .42], [.35, .46], [.6, .4], [1, .45]], .7 * u, pal.road, pal.edge); road([[.45, 0], [.5, .3], [.52, .6]], .7 * u, pal.road, pal.edge); mem.map = mc; }
  const e = lt < 4.8 ? spr(lt - 1, 5.5, 8.5) : 1 - spr(lt - 4.9, 6.5, 10), ec = clamp(e), X = S / 2 - 12 * u, cy = S / 2 + 1 * u;
  x.globalAlpha = 1 - ec; txt(x, "Nearby", X, S / 2 - 10.8 * u, 1.7 * u, c.text, "left"); [["Old boathouse", "0.9 mi"], ["Pine Lodge", "1.4 mi"]].forEach(([a, b], i) => { const y = S / 2 - 8.2 * u + i * 4.4 * u; glassFill(x, c, u, X, y, 24 * u, 3.8 * u, 1.5 * u); txt(x, a, X + 1.4 * u, y + 1.9 * u, 1.1 * u, c.text, "left"); txt(x, b, X + 22.6 * u, y + 1.9 * u, 1 * u, c.muted, "right"); }); x.globalAlpha = 1;
  const card = R2([X, cy, 24 * u, 9 * u], [S / 2 - 13 * u, S / 2 + 6.2 * u, 26 * u, 8.4 * u], e); glassFill(x, c, u, card[0], card[1], card[2], card[3], 1.8 * u);
  const mr = R2([X + .7 * u, cy + .7 * u, 7.6 * u, 7.6 * u], [S / 2 - 13 * u, S / 2 - 11.4 * u, 26 * u, 17 * u], e), MS = mem.map.width, sc = 1.15;
  x.save(); rr(x, mr[0], mr[1], mr[2], mr[3], lerp(1.2, 2.2, ec) * u); x.clip(); const sw = mr[2] * sc, shh = mr[3] * sc; x.drawImage(mem.map, MS / 2 - sw / 2, MS / 2 - shh / 2 + (MS * .04), sw, shh, mr[0], mr[1], mr[2], mr[3]); x.restore();
  const px = mr[0] + mr[2] / 2, py = mr[1] + mr[3] / 2 + 1 * u * (1 - ec), drop = lt > 1 && lt < 4.8 ? (1 - clamp(spr(lt - 1.25, 7, 12), 0, 1.2)) * 4 * u : 0, ps = lerp(.65, 1, ec);
  x.save(); x.globalAlpha = .25; x.fillStyle = "#000"; x.beginPath(); x.ellipse(px, py, ps * .9 * u * (1 - drop / (8 * u)), ps * .35 * u, 0, 0, 7); x.fill(); x.restore();
  x.save(); x.translate(px, py - drop); x.scale(ps, ps); x.fillStyle = c.signal; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-.6 * u, -1.4 * u, -1.6 * u, -2 * u, -1.6 * u, -3.2 * u); x.arc(0, -3.2 * u, 1.6 * u, Math.PI, 0); x.bezierCurveTo(1.6 * u, -2 * u, .6 * u, -1.4 * u, 0, 0); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = .2 * u; x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(0, -3.2 * u, .6 * u, 0, 7); x.fill(); x.restore();
  const tp = R2([X + 9.6 * u, cy + 3 * u], [card[0] + 1.6 * u, card[1] + 2.6 * u], e); txt(x, "Harbor Inn", tp[0], tp[1], lerp(1.2, 1.5, ec) * u, c.text, "left"); txt(x, "0.4 mi · Open until 22:00", tp[0], tp[1] + 1.8 * u, 1 * u, c.muted, "left");
  const da = clamp(e * 2 - 1); if (da > 0) { x.globalAlpha = da; x.fillStyle = c.text; rr(x, card[0] + 1.6 * u, card[1] + 5 * u, 12 * u, 2.6 * u, 1.1 * u); x.fill(); txt(x, "Directions", card[0] + 7.6 * u, card[1] + 6.3 * u, 1.05 * u, c.page); glassFill(x, c, u, mr[0] + 1.2 * u, mr[1] + 1.2 * u, 3.2 * u, 3.2 * u, 1.35 * u); icon(x, IC.back, mr[0] + 2.7 * u, mr[1] + 2.8 * u, 1.5 * u, c.text, { lw: 2.4 }); x.globalAlpha = 1; }
  touch(lt < 3 ? S / 2 : S / 2 - 10.2 * u, lt < 3 ? cy + 4.5 * u : S / 2 - 8.6 * u, (lt > .8 && lt < 1) || (lt > 4.6 && lt < 4.8));
}];
/* 221 Book Pull */
SK.BookPull = [6.8, ({ x, S, u, lt, c, touch }) => {
  const shelfY = S / 2 + 7 * u, books = [[2.6, 13, "#2e8bff", "Tides"], [3.2, 15, "#ffc21a", "North"], [2.4, 12.5, "#00c4a7", "Pines"], [3.4, 15.5, "#ff8a1f", "Lake Days"], [2.8, 14, "#ff005c", "Herons"], [3, 13.5, "#ff8a1f", "Ember"], [2.5, 14.5, "#ffc21a", "Maps"]];
  const tot = books.reduce((a, b) => a + b[0] + .3, 0) * u; let bx = S / 2 - tot / 2; const pos = books.map(b => { const p = bx; bx += (b[0] + .3) * u; return p; });
  const o = lt < 4.6 ? 1 : 0, up = o ? easeIO(seg(lt, 1, 1.6)) : 1 - easeIO(seg(lt, 5.4, 6)), turn = o ? easeIO(seg(lt, 1.6, 2.6)) : 1 - easeIO(seg(lt, 4.6, 5.4)), dim = Math.max(up * .8, turn);
  const spine = (X, Y, w, h, col, t, sw = 1) => { if (w < .02 * u) return; x.fillStyle = col; rr(x, X, Y, w, h, .35 * u); x.fill(); x.fillStyle = `rgba(0,0,0,${.06 + .25 * (1 - sw)})`; rr(x, X, Y, w, h, .35 * u); x.fill(); x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(X, Y + 1.2 * u, w, .25 * u); x.fillRect(X, Y + h - 1.5 * u, w, .25 * u); if (w > 1.2 * u) { x.save(); x.translate(X + w / 2, Y + h / 2); x.rotate(Math.PI / 2); x.scale(1, sw); txt(x, t, 0, 0, Math.min(1, w / u * .38) * u, "#141414", "center", 600); x.restore(); } };
  books.forEach(([w, h, col, t], i) => { if (i === 3) return; x.globalAlpha = 1 - .55 * dim; spine(pos[i], shelfY - h * u, w * u, h * u, col, t); }); x.globalAlpha = 1;
  x.fillStyle = c.text; rr(x, S / 2 - 14 * u, shelfY, 28 * u, .7 * u, .35 * u); x.fill();
  const [w, h, col, t] = books[3], ch = lerp(h * u, 19 * u, turn), cw = 13.5 * u * Math.sin(turn * Math.PI / 2), sw = w * u * Math.cos(turn * Math.PI / 2) * lerp(1, 1.25, turn);
  const tw2 = sw + cw, cx = lerp(pos[3] + w * u / 2, S / 2, turn), top = lerp(shelfY - h * u - 4 * u * up, S / 2 - 12.5 * u, turn), X0 = cx - tw2 / 2;
  if (turn > 0) { x.save(); x.shadowColor = c.shadow; x.shadowBlur = 2.4 * u * turn; x.shadowOffsetY = 1 * u * turn; x.fillStyle = "#000"; rr(x, X0, top, tw2, ch, .6 * u); x.fill(); x.restore(); }
  spine(X0, top, sw, ch, col, t, Math.cos(turn * Math.PI / 2) * .5 + .5);
  if (cw > .05 * u) { x.save(); rr(x, X0 + sw, top, cw, ch, .6 * u); x.clip(); x.fillStyle = col; x.fillRect(X0 + sw, top, cw, ch); x.drawImage(photo(13.5 * u, 11 * u, 0), X0 + sw + cw * .08, top + ch * .26, cw * .84, ch * .52); x.fillStyle = `rgba(0,0,0,${.3 * (1 - turn)})`; x.fillRect(X0 + sw, top, cw, ch); x.save(); x.translate(X0 + sw + cw / 2, top); x.scale(cw / (13.5 * u), 1); txt(x, "Lake Days", 0, ch * .12, 1.7 * u, "#141414", "center", 700); txt(x, "R. HALE", 0, ch * .88, .9 * u, "#141414", "center", 700); x.restore(); x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(X0 + sw, top, .3 * u, ch); x.restore(); }
  const ta = clamp(turn * 2 - 1); if (ta > 0) { x.globalAlpha = ta; pill(x, c, u, S / 2, S / 2 + 10.6 * u, "Start reading", { fill: c.text, ink: c.page, glass: false }); x.globalAlpha = 1; }
  touch(lt < 3 ? pos[3] + w * u / 2 : S / 2 - 8 * u, lt < 3 ? shelfY - 6 * u : S / 2 - 12 * u, (lt > .8 && lt < 1) || (lt > 4.4 && lt < 4.6));
}];

/* Voice Dictation */
SK.VoiceDictation = [8, ({ x, S, u, lt, t, c, touch, mem }) => {
  const e = lt < 1.1 ? 0 : lt < 6.4 ? eo(seg(lt, 1.1, 1.6)) : 1 - eo(seg(lt, 6.45, 6.9));
  const H = 5.4 * u, R = S / 2 + 13 * u, W = lerp(H, 26 * u, e), X = R - W, cy = S / 2;
  const fw = 26 * u - H - 1 * u;
  x.save(); x.globalAlpha = 1 - e; glassFill(x, c, u, S / 2 - 13 * u, cy - H / 2, fw, H, H * .42); icon(x, IC.search, S / 2 - 10.8 * u, cy, 1.6 * u, c.muted, { lw: 2.2 }); txt(x, mem.done ? "Lake trails near Ida" : "Search trails", S / 2 - 8.8 * u, cy, 1.15 * u, mem.done ? c.text : c.muted, "left"); x.restore();
  glassFill(x, c, u, X, cy - H / 2, W, H, H * .42);
  x.save(); x.globalAlpha = 1 - clamp(e * 3); icon(x, IC.mic, R - H / 2, cy, 2.2 * u, c.text, { lw: 2.2 }); x.restore();
  if (lt < 1) mem.done = false; if (lt > 6.45) mem.done = true;
  if (e > 0) {
    x.save(); x.globalAlpha = clamp(e * 1.4 - .2);
    const br = 2 * u, lx = X + H / 2, rx = R - H / 2;
    x.fillStyle = c.trough; x.beginPath(); x.arc(lx, cy, br, 0, 7); x.fill(); icon(x, IC.x, lx, cy, 1.4 * u, c.text, { lw: 2.4 });
    x.fillStyle = c.signal; x.beginPath(); x.arc(rx, cy, br, 0, 7); x.fill(); icon(x, IC.check, rx, cy, 1.5 * u, "#141414", { lw: 2.8 });
    const hist = mem.hist || (mem.hist = []);
    const live = lt > 1.4 && lt < 6.4, s = t, syl = Math.max(0, Math.sin(s * 9.1) * .5 + Math.sin(s * 5.3) * .35 + Math.sin(s * 17.7) * .2 + .15), phrase = sm(-.35, .25, Math.sin(s * .85));
    const target = live ? clamp(syl * phrase * 1.25) : 0;
    if (!mem.bt || t - mem.bt > .06 || t < mem.bt) { const prev = hist.length ? hist[hist.length - 1] : 0; hist.push(prev + (target - prev) * .6); mem.bt = t; if (hist.length > 90) hist.shift(); }
    const bx0 = lx + 3.2 * u, bx1 = rx - 3.2 * u, step = .75 * u;
    x.beginPath(); x.rect(bx0, cy - H / 2, bx1 - bx0, H); x.clip(); x.fillStyle = c.text;
    for (let i = hist.length - 1, k = 0; i >= 0; i--, k++) { const bx = bx1 - k * step; if (bx < bx0 - step) break; const fade = clamp((bx - bx0) / (3 * u)); const bh = Math.max(.32 * u, hist[i] * 3.2 * u); x.globalAlpha = clamp(e * 1.4 - .2) * fade; rr(x, bx - .16 * u, cy - bh / 2, .32 * u, bh, .16 * u); x.fill(); }
    x.restore();
  } else mem.hist = [];
  touch(lt < 3 ? R - H / 2 : R - H / 2, cy, (lt > .85 && lt < 1.15) || (lt > 6.2 && lt < 6.5));
}];

/* Spoiler */
const hrand = (i, k) => { let a = (i * 1000003 + k * 7919) | 0; a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; };
const fold = (v, L) => { const p = L * 2; let m = v % p; if (m < 0) m += p; return m > L ? p - m : m; };
SK.Spoiler = [6.8, ({ x, S, u, lt, t, c, touch }) => {
  const X = S / 2 - 12.5 * u, top = S / 2 - 8 * u, px = 1.25 * u, lh = 2.2 * u;
  txt(x, "Lake Ida", X, top, 1.8 * u, c.text, "left");
  lines(x, ["A slow, warm film about a summer", "on the water. The best this year."], X, top + 3.2 * u, lh, px, c.muted);
  const hidden = ["The ending: the ferry never comes,", "and Maya rows the family home."];
  const y0 = top + 8.6 * u, rects = hidden.map((s, i) => [X, y0 + i * lh - lh / 2, tw(x, s, px), lh]);
  const T = 2.2, tapX = X + 9 * u, tapY = y0 + lh / 2, since = lt - T, back = seg(lt, 5.4, 6.1), revealed = lt > T && lt < 5.4;
  if (revealed) { const r = 26 * u * eo(clamp(since / .75)); x.save(); x.beginPath(); x.arc(tapX, tapY, r, 0, 7); x.clip(); lines(x, hidden, X, y0, lh, px, c.text); x.restore(); }
  const blow = revealed ? since : 0;
  if (!revealed || blow < 1.3) {
    x.fillStyle = c.text; const now = revealed ? T : t, cover = lt >= 5.4 ? back : 1;
    rects.forEach(([rx, ry, rw, rh], ri) => {
      const n = Math.min(1100, Math.round(rw * rh / (u * u) * 7));
      for (let i = 0; i < n; i++) {
        const id = ri * 5000 + i, life = .9 + hrand(id, 1) * 1.6, sh = hrand(id, 2) * life, cyc = Math.floor((now + sh) / life), lo = (now + sh) / life - cyc, sd = id * 7919 + cyc;
        const a = hrand(sd, 3) * 6.283, v = (.35 + hrand(sd, 4) * .75) * u;
        let px2 = fold(hrand(sd, 5) * rw + Math.cos(a) * v * lo * life, rw) + rx, py2 = fold(hrand(sd, 6) * rh + Math.sin(a) * v * lo * life, rh) + ry;
        let al = Math.sin(Math.PI * lo) * (.5 + hrand(sd, 7) * .5) * sm(0, .5 * u, px2 - rx) * sm(0, .5 * u, rx + rw - px2);
        if (blow > 0) { const dx = px2 - tapX, dy = py2 - tapY, d = Math.max(Math.hypot(dx, dy), 1), push = (6 + 40 * Math.exp(-d / (9 * u)) + hrand(id, 8) * 9) * u / 6.5, tr = push * (1 - Math.exp(-.9 * blow)) / .9; px2 += dx / d * tr; py2 += dy / d * tr * .6; al *= Math.max(0, 1 - blow / (.5 + hrand(id, 11) * .6)); }
        al *= cover; if (al < .03) continue;
        const z = (.13 + hrand(sd, 12) * .13) * u; x.globalAlpha = al; x.fillRect(px2 - z / 2, py2 - z / 2, z, z);
      }
    });
    x.globalAlpha = 1;
  }
  touch(tapX, tapY, lt > T - .25 && lt < T + .05);
}];

/* Marker */
SK.Marker = [7.4, ({ x, S, u, lt, c }) => {
  const X = S / 2 - 13 * u, top = S / 2 - 5 * u, px = 1.5 * u, lh = 3.6 * u;
  const L = [["Pack ", ["light layers", "hl"], ", the forecast"], ["says ", ["rain after 4 PM", "ul"], ", and please"], [["bring your passport", "ci"], "."]];
  const fade = 1 - seg(lt, 6.3, 6.8), slots = { hl: [.8, 1.35], ul: [1.75, 2.3], ci: [2.7, 3.5] };
  txt(x, "Trip notes", X, top - 4 * u, 1.1 * u, c.muted, "left");
  const marks = [];
  L.forEach((parts, li) => { let cx = X; const y = top + li * lh; parts.forEach(p => { const s = typeof p === "string" ? p : p[0], w = tw(x, s, px); if (typeof p !== "string") marks.push({ kind: p[1], s, X: cx, y, w }); cx += w; }); });
  const amt = m => eo(seg(lt, slots[m.kind][0], slots[m.kind][1])) * fade;
  marks.filter(m => m.kind === "hl").forEach((m, i) => { const a = amt(m); if (a <= 0) return; const R = mulberry(11 + i), r = () => (R() - .5) * .35 * u, t0 = m.y - px * .62, b0 = m.y + px * .58; x.save(); x.beginPath(); x.rect(m.X - .4 * u, t0 - u, (m.w + .8 * u) * a, px * 2 + 2 * u); x.clip(); x.globalAlpha = .9 * fade; x.fillStyle = "#ffc21a"; x.beginPath(); x.moveTo(m.X - .25 * u, t0 + r()); x.quadraticCurveTo(m.X + m.w / 2, t0 + r(), m.X + m.w + .3 * u, t0 + r()); x.lineTo(m.X + m.w + .15 * u, b0 + r()); x.quadraticCurveTo(m.X + m.w / 2, b0 + r(), m.X - .35 * u, b0 + r()); x.closePath(); x.fill(); x.restore(); });
  L.forEach((parts, li) => { let cx = X; const y = top + li * lh; parts.forEach(p => { const s = typeof p === "string" ? p : p[0], w = tw(x, s, px), m = typeof p !== "string" && p[1] === "hl" ? marks.find(q => q.s === s) : null; txt(x, s, cx, y, px, m && amt(m) > .5 ? "#141414" : c.text, "left"); cx += w; }); });
  x.strokeStyle = c.signal; x.lineCap = x.lineJoin = "round";
  marks.filter(m => m.kind !== "hl").forEach((m, i) => {
    const a = amt(m); if (a <= 0) return; const R = mulberry(31 + i * 7), r = () => (R() - .5), pts = [];
    if (m.kind === "ul") { const y = m.y + px * .78, c1 = [m.X + m.w * .3, y + .3 * u + r() * .3 * u], c2 = [m.X + m.w * .6, y - .3 * u + r() * .3 * u], p0 = [m.X, y + r() * .2 * u], p3 = [m.X + m.w, y + r() * .2 * u]; for (let k = 0; k <= 40; k++) { const q = k / 40, iq = 1 - q; pts.push([iq * iq * iq * p0[0] + 3 * iq * iq * q * c1[0] + 3 * iq * q * q * c2[0] + q * q * q * p3[0], iq * iq * iq * p0[1] + 3 * iq * iq * q * c1[1] + 3 * iq * q * q * c2[1] + q * q * q * p3[1]]); } x.lineWidth = .2 * u; }
    else { const cx = m.X + m.w / 2, cy = m.y, rx = m.w / 2 + .6 * u, ry = px * .75 + .2 * u; for (let k = 0; k <= 54; k++) { const an = -Math.PI / 2 - .3 + k / 50 * Math.PI * 2; pts.push([cx + Math.cos(an) * rx * (1 + r() * .05), cy + Math.sin(an) * ry * (1 + r() * .08)]); } x.lineWidth = .17 * u; }
    const n = Math.max(2, Math.round(pts.length * a)); x.globalAlpha = fade; x.beginPath(); pts.slice(0, n).forEach(([a1, b1], k) => k ? x.lineTo(a1, b1) : x.moveTo(a1, b1)); x.stroke(); x.globalAlpha = 1;
  });
}];

/* Distortion Wave */
SK.DistortionWave = [5.6, ({ x, S, u, lt, t, c, mem, touch }) => {
  const VW = 200, VH = 260, BX = 100, BY = 228, RAMP3 = [[255, 193, 214], [255, 138, 92], [242, 54, 28]];
  const ramp = p => { p = clamp(p) * 1.999; const i = Math.floor(p), f = p - i, a = RAMP3[i], b = RAMP3[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
  const key = c.glass + c.text;
  if (mem.key !== key) {
    mem.key = key;
    const view = kind => { const [cv, v] = mkc(VW, VH); v.fillStyle = c.glass; v.fillRect(0, 0, VW, VH); v.textAlign = "center"; v.textBaseline = "alphabetic";
      if (!kind) { v.fillStyle = "#ffc21a"; v.beginPath(); v.arc(100, 46, 16, 0, 7); v.fill(); v.fillStyle = "#141414"; v.font = font(11); v.fillText("MC", 100, 50); v.fillStyle = c.muted; v.font = font(10.5); v.fillText("Sending to Maya Chen", 100, 82); v.fillStyle = c.text; v.font = font(26); v.fillText("$1,250.00", 100, 116); v.strokeStyle = c.line; v.beginPath(); v.roundRect(16.5, 134.5, 167, 56, 10); v.stroke(); v.beginPath(); v.moveTo(16, 162.5); v.lineTo(184, 162.5); v.stroke(); v.font = font(10); v.textAlign = "left"; v.fillStyle = c.muted; v.fillText("From", 28, 152); v.fillText("Arrives", 28, 180); v.textAlign = "right"; v.fillStyle = c.text; v.fillText("Everyday ··4821", 172, 152); v.fillText("In seconds", 172, 180); v.fillStyle = c.signal; v.beginPath(); v.roundRect(16, 206, 168, 44, 18); v.fill(); v.textAlign = "center"; v.fillStyle = "#141414"; v.font = font(13); v.fillText("Confirm", 100, 232); }
      else { v.fillStyle = c.signal; v.beginPath(); v.arc(100, 84, 26, 0, 7); v.fill(); v.strokeStyle = "#fff"; v.lineWidth = 3.4; v.lineCap = v.lineJoin = "round"; v.beginPath(); v.moveTo(89, 85); v.lineTo(96.5, 92); v.lineTo(111, 77); v.stroke(); v.fillStyle = c.text; v.font = font(22); v.fillText("Sent", 100, 144); v.fillStyle = c.muted; v.font = font(10.5); v.fillText("$1,250.00 to Maya Chen", 100, 164); v.fillText("Arrives in a few seconds", 100, 180); v.fillStyle = c.trough; v.beginPath(); v.roundRect(16, 206, 168, 44, 18); v.fill(); v.fillStyle = c.text; v.font = font(13); v.fillText("Done", 100, 232); }
      return v.getImageData(0, 0, VW, VH).data; };
    mem.A = view(0); mem.B = view(1); const [oc, ox] = mkc(VW, VH); mem.oc = oc; mem.ox = ox; mem.out = ox.createImageData(VW, VH);
  }
  const easeC = p => p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2, maxR = 290;
  const Rr = lt < 1.3 ? 0 : lt < 2.6 ? easeC((lt - 1.3) / 1.3) * maxR : lt < 4.3 ? maxR : lt < 5.3 ? (1 - easeC((lt - 4.3) / 1)) * maxR : 0;
  if (mem.lastR !== Rr || mem.lastKey !== key) {
    mem.lastR = Rr; mem.lastKey = key; const o = mem.out.data, A = mem.A, B = mem.B, bw = 28;
    for (let j = 0; j < VH; j++) for (let i = 0; i < VW; i++) {
      const dx = i - BX, dy = j - BY, d = Math.hypot(dx, dy) || 1, q = d - Rr, b = (j * VW + i) * 4; let src = A, sx = i, sy = j;
      if (Rr > 0) { if (q < 0) { src = B; const pull = q > -bw ? (bw + q) * .5 : 0; sx += dx / d * pull; sy += dy / d * pull; } else if (q < bw) { const pull = -(bw - q) * .6; sx += dx / d * pull; sy += dy / d * pull; } }
      sx = Math.max(0, Math.min(VW - 1, sx | 0)); sy = Math.max(0, Math.min(VH - 1, sy | 0)); const kk = (sy * VW + sx) * 4; let r = src[kk], g = src[kk + 1], bl = src[kk + 2];
      if (Rr > 0 && Rr < maxR && q > -12 && q < 9) { const e = (q < 0 ? 1 + q / 12 : 1 - q / 9) * .9, cc = ramp(.2 + .6 * (.5 + .5 * Math.sin(Math.atan2(dy, dx) * 2 + t * 1.5))); r += (cc[0] - r) * e; g += (cc[1] - g) * e; bl += (cc[2] - bl) * e; }
      o[b] = r; o[b + 1] = g; o[b + 2] = bl; o[b + 3] = 255;
    }
    mem.ox.putImageData(mem.out, 0, 0);
  }
  const w = 20 * u, h = 26 * u, X = (S - w) / 2, Y = (S - h) / 2;
  glassFill(x, c, u, X, Y, w, h, 2.4 * u); x.save(); rr(x, X, Y, w, h, 2.4 * u); x.clip(); x.imageSmoothingQuality = "high"; x.drawImage(mem.oc, X, Y, w, h); x.restore();
  touch(X + BX / VW * w, Y + BY / VH * h, lt > 1.05 && lt < 1.35);
}];
