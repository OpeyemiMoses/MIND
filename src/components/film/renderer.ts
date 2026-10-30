/**
 * Mind Launch Film — frame renderer.
 *
 * Every pixel is a pure function of time `t` (timeline) and `amb` (ambient clock), so the
 * film has zero dead frames: each frame layers
 *   - Macro motion  (camera dolly / roll, scene geometry, relay-race morphs)
 *   - Meso motion   (counters, rings, connectors, typewriters, scanners)
 *   - Micro motion  (grid scroll, gold dust, gyro drift, light sweeps, HUD telemetry)
 */
import { ACTS, BEAT, FILM_DURATION, VO_CUES } from './timeline';

export const W = 1920;
export const H = 1080;

export interface FilmAssets {
  laptopDark: CanvasImageSource;
  laptopLight: CanvasImageSource;
}

export interface FilmFonts {
  display: string;
  sans: string;
  mono: string;
}

export interface FrameOptions {
  captions: boolean;
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const GOLD = '#D4AF37';
const GOLD2 = '#E7C45D';
const GOLD3 = '#FFF0B3';
const EMERALD = '#2CCD9A';
const ROSE = '#E5484D';
const IVORY = '#FAF8F5';
const TEXT = '#F5F2EA';
const MUTED = 'rgba(245,242,234,0.55)';

// ---------------------------------------------------------------- math helpers
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** ≈ cubic-bezier(0.16, 1, 0.3, 1) */
const easeOut = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeIn = (p: number) => p * p * p;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Damped spring (stiffness ~180, damping ~16) evaluated on seconds since trigger. */
const spring = (s: number, k = 6.5, w = 10.5) => (s <= 0 ? 0 : 1 - Math.exp(-k * s) * Math.cos(w * s));
const bump = (t: number, c: number, w: number) => Math.exp(-Math.pow((t - c) / w, 2));
const smooth = (p: number) => p * p * (3 - 2 * p);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = '0123456789abcdef';
function hexString(r: () => number, n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += HEX[Math.floor(r() * 16)];
  return s;
}

interface Kf {
  t: number;
  x: number;
  y: number;
  s: number;
  a: number;
}
/** Keyframe interpolation with ease-in-out between neighbours. */
function kf(t: number, keys: Kf[]): Kf {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (t <= k1.t) {
      const p = easeInOut((t - k0.t) / (k1.t - k0.t));
      return { t, x: lerp(k0.x, k1.x, p), y: lerp(k0.y, k1.y, p), s: lerp(k0.s, k1.s, p), a: lerp(k0.a, k1.a, p) };
    }
  }
  return keys[keys.length - 1];
}

// ---------------------------------------------------------------- precomputed data
const R = rng(20261030);
const PARTICLES = Array.from({ length: 110 }, () => ({
  x: R() * 2 - 1,
  y: R() * 2 - 1,
  z: R(),
  speed: 0.02 + R() * 0.05,
  size: 0.6 + R() * 1.8,
  phase: R() * Math.PI * 2,
}));
const HASHES = Array.from({ length: 38 }, (_, i) => ({
  x: (R() * 2 - 1) * 860,
  y: (R() * 2 - 1) * 440,
  phase: R(),
  rate: 0.14 + R() * 0.12,
  text:
    i % 3 === 0
      ? `0x${hexString(R, 6)}...${hexString(R, 4)}`
      : i % 3 === 1
        ? `BAL ${(R() * 9000).toFixed(2)} SUI`
        : `TX ${hexString(R, 4).toUpperCase()}${hexString(R, 3)}...`,
}));
const SPARK = (() => {
  const r = rng(7);
  const pts: number[] = [];
  let v = 0.25;
  for (let i = 0; i < 48; i++) {
    v += (r() - 0.38) * 0.07;
    v = clamp(v, 0.08, 0.95);
    pts.push(v);
  }
  return pts;
})();

// Logo polygons (from public/icon.svg, transform translate(4,3) scale(0.92), centred on 50,50)
const LOGO_POLYS: [number, number][][] = [
  [[16, 26], [34, 15], [34, 84], [16, 72]],
  [[34, 36], [51, 49], [66, 33], [66, 54], [50, 70], [34, 57]],
  [[66, 21], [85, 10], [85, 79], [66, 91]],
].map((poly) => poly.map(([x, y]) => [4 + x * 0.92 - 50, 3 + y * 0.92 - 50] as [number, number]));
const LOGO_GRADS: [string, string, string][] = [
  ['#FBE69B', '#D9B343', '#947114'],
  ['#A67F1A', '#E6C35C', '#FFF0B3'],
  ['#FFF1B8', '#E2BE52', '#9E7916'],
];

// ---------------------------------------------------------------- drawing helpers
let F: FilmFonts = { display: 'sans-serif', sans: 'sans-serif', mono: 'monospace' };

function font(ctx: Ctx, size: number, kind: 'display' | 'sans' | 'mono' = 'sans', weight = 600) {
  ctx.font = `${weight} ${size}px ${F[kind]}`;
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { kind?: 'display' | 'sans' | 'mono'; weight?: number; align?: CanvasTextAlign; spacing?: number; alpha?: number } = {}
) {
  font(ctx, size, opts.kind ?? 'sans', opts.weight ?? 600);
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  ctx.letterSpacing = `${opts.spacing ?? 0}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = prevAlpha;
}

function measure(ctx: Ctx, s: string, size: number, kind: 'display' | 'sans' | 'mono' = 'sans', weight = 600, spacing = 0) {
  font(ctx, size, kind, weight);
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = '0px';
  return w;
}

function wrap(ctx: Ctx, s: string, maxW: number, size: number, kind: 'display' | 'sans' | 'mono' = 'sans', weight = 500) {
  font(ctx, size, kind, weight);
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function glass(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  o: { border?: string; borderAlpha?: number; glow?: number; fill?: string; shadow?: boolean } = {}
) {
  ctx.save();
  if (o.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 26;
  }
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, o.fill ?? 'rgba(28,26,22,0.86)');
  g.addColorStop(1, 'rgba(12,12,14,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (o.glow) {
    ctx.shadowColor = o.border ?? GOLD;
    ctx.shadowBlur = o.glow;
  }
  ctx.strokeStyle = o.border ?? GOLD;
  ctx.globalAlpha *= o.borderAlpha ?? 0.4;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  ctx.restore();
  // top specular hairline
  ctx.save();
  const hl = ctx.createLinearGradient(x, 0, x + w, 0);
  hl.addColorStop(0, 'rgba(255,240,179,0)');
  hl.addColorStop(0.5, 'rgba(255,240,179,0.35)');
  hl.addColorStop(1, 'rgba(255,240,179,0)');
  ctx.strokeStyle = hl;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1.5);
  ctx.lineTo(x + w - r, y + 1.5);
  ctx.stroke();
  ctx.restore();
}

function pill(ctx: Ctx, cx: number, cy: number, label: string, color: string, size = 15, filled = false) {
  const w = measure(ctx, label, size, 'mono', 600, 1.5) + 34;
  const h = size + 18;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(10,10,10,0.6)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  text(ctx, label, cx, cy + 1, size, filled ? '#0A0A0A' : color, { kind: 'mono', align: 'center', spacing: 1.5 });
  return w;
}

function check(ctx: Ctx, x: number, y: number, s: number, color: string, p = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const pts: [number, number][] = [
    [x - s * 0.4, y],
    [x - s * 0.1, y + s * 0.3],
    [x + s * 0.45, y - s * 0.35],
  ];
  const seg1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const seg2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const L = (seg1 + seg2) * p;
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (L <= seg1) {
    const q = L / seg1;
    ctx.lineTo(lerp(pts[0][0], pts[1][0], q), lerp(pts[0][1], pts[1][1], q));
  } else {
    ctx.lineTo(pts[1][0], pts[1][1]);
    const q = (L - seg1) / seg2;
    ctx.lineTo(lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q));
  }
  ctx.stroke();
  ctx.restore();
}

function ring(ctx: Ctx, cx: number, cy: number, r: number, p: number, color: string, width = 8) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
  ctx.stroke();
  ctx.restore();
}

/** Mind origami emblem. `draw` 0..1 strokes the outline, `fill` 0..1 floods the gold facets. */
function logo(ctx: Ctx, cx: number, cy: number, size: number, amb: number, draw = 1, fill = 1, glow = 1) {
  const s = size / 100;
  const yaw = Math.sin(amb * 0.8) * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(Math.cos(yaw), Math.sin(yaw) * 0.12, 0, 1, 0, 0);
  ctx.scale(s, s);
  if (fill > 0) {
    LOGO_POLYS.forEach((poly, i) => {
      const xs = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      const c = LOGO_GRADS[i];
      g.addColorStop(0, c[0]);
      g.addColorStop(0.5, c[1]);
      g.addColorStop(1, c[2]);
      ctx.save();
      ctx.globalAlpha *= fill;
      ctx.shadowColor = 'rgba(212,175,55,0.7)';
      ctx.shadowBlur = 30 * glow;
      ctx.fillStyle = g;
      ctx.beginPath();
      poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // moving specular sheen across facets
    ctx.save();
    ctx.globalAlpha *= fill * 0.55;
    ctx.beginPath();
    LOGO_POLYS.forEach((poly) => {
      poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    });
    ctx.clip();
    const sx = ((amb * 0.45) % 1.6) * 160 - 130;
    const sg = ctx.createLinearGradient(sx - 20, -50, sx + 20, 50);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(-60, -60, 120, 120);
    ctx.restore();
  }
  if (draw < 1 || fill < 1) {
    ctx.save();
    ctx.strokeStyle = GOLD3;
    ctx.lineWidth = 1.1;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12;
    ctx.globalAlpha *= 1 - fill * 0.85;
    LOGO_POLYS.forEach((poly) => {
      let len = 0;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % poly.length];
        len += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      ctx.setLineDash([len * draw, len]);
      ctx.beginPath();
      poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- global layers
function warpIntegral(t: number) {
  const T: [number, number][] = [
    [28.5, 1.7],
    [70.4, 0.55],
    [85.8, 0.5],
    [110.2, 0.8],
    [137.0, 1.5],
  ];
  let v = 0;
  for (const [c, a] of T) v += a * smooth(clamp((t - (c - 1.2)) / 2.4));
  return v;
}
function warpSpeed(t: number) {
  return bump(t, 28.5, 0.9) * 1.6 + bump(t, 70.4, 0.6) * 0.5 + bump(t, 85.8, 0.6) * 0.5 + bump(t, 110.2, 0.8) * 0.7 + bump(t, 137, 0.9) * 1.4;
}

function background(ctx: Ctx, t: number, amb: number) {
  const cx = W / 2 + Math.sin(amb * 0.11) * 220;
  const cy = H / 2 + Math.cos(amb * 0.09) * 120;
  const g = ctx.createRadialGradient(cx, cy, 40, W / 2, H / 2, 1250);
  const warmth = 0.08 + 0.05 * Math.sin(amb * 0.4) + bump(t, 137, 3) * 0.1 + bump(t, 23.5, 3) * 0.06;
  g.addColorStop(0, `rgba(60,46,18,${0.55 + warmth})`);
  g.addColorStop(0.35, 'rgba(20,17,12,1)');
  g.addColorStop(1, '#050505');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function gridAlpha(t: number) {
  if (t < 28.5) return lerp(0.28, 0.55, prog(t, 0, 3));
  if (t < 70.4) return 0.22;
  if (t < 110.2) return 0.3;
  if (t < 137) return 0.18;
  return 0.26;
}

function grid(ctx: Ctx, t: number, amb: number) {
  const a = gridAlpha(t);
  const horizon = H * 0.56 + Math.sin(amb * 0.2) * 10;
  const scroll = (amb * 0.35 + warpIntegral(t) * 2.5) % 1;
  ctx.save();
  ctx.lineWidth = 1;
  // floor rows
  for (let i = 0; i < 22; i++) {
    const z = (i + 1 - scroll) / 22; // 0..1 far..near
    const y = horizon + Math.pow(z, 2.4) * (H - horizon + 260);
    ctx.strokeStyle = `rgba(212,175,55,${a * z * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // converging columns
  const vx = W / 2 + Math.sin(amb * 0.15) * 60;
  for (let i = -16; i <= 16; i++) {
    ctx.strokeStyle = `rgba(212,175,55,${a * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(vx + i * 8, horizon);
    ctx.lineTo(vx + i * 240, H + 80);
    ctx.stroke();
  }
  // horizon glow
  const hg = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 60);
  hg.addColorStop(0, 'rgba(212,175,55,0)');
  hg.addColorStop(0.5, `rgba(212,175,55,${a * 0.25})`);
  hg.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizon - 60, W, 120);
  // fade the floor into darkness near horizon
  const fade = ctx.createLinearGradient(0, horizon, 0, horizon + 220);
  fade.addColorStop(0, 'rgba(8,8,8,0.85)');
  fade.addColorStop(1, 'rgba(8,8,8,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, W, 220);
  ctx.restore();
}

function particles(ctx: Ctx, t: number, amb: number) {
  const warp = warpIntegral(t);
  const ws = warpSpeed(t);
  ctx.save();
  for (const p of PARTICLES) {
    const z = 1 - ((p.z + amb * p.speed + warp * 0.9) % 1); // 1 far -> 0 near
    const zz = 0.08 + z * 0.92;
    const sx = W / 2 + (p.x * W * 0.55) / zz + Math.sin(amb * 0.5 + p.phase) * 6;
    const sy = H / 2 + (p.y * H * 0.55) / zz + Math.cos(amb * 0.4 + p.phase) * 6;
    if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
    const alpha = clamp((1 - z) * 1.4) * (0.35 + 0.35 * Math.sin(amb * 2 + p.phase));
    const size = (p.size / zz) * 0.5;
    if (ws > 0.08) {
      const z2 = clamp(z + ws * 0.05, 0, 1);
      const zz2 = 0.08 + z2 * 0.92;
      const px = W / 2 + (p.x * W * 0.55) / zz2;
      const py = H / 2 + (p.y * H * 0.55) / zz2;
      ctx.strokeStyle = `rgba(255,232,160,${alpha * 0.8})`;
      ctx.lineWidth = Math.max(1, size);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(240,210,120,${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.min(size, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function lightSweep(ctx: Ctx, amb: number) {
  const period = 3.2;
  const p = (amb % period) / period;
  const x = lerp(-600, W + 600, p);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - 260, 0, x + 260, H * 0.4);
  g.addColorStop(0, 'rgba(255,240,179,0)');
  g.addColorStop(0.5, 'rgba(255,240,179,0.035)');
  g.addColorStop(1, 'rgba(255,240,179,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function flash(ctx: Ctx, t: number) {
  const v =
    bump(t, 28.45, 0.32) * 0.95 +
    bump(t, 70.4, 0.25) * 0.14 +
    bump(t, 85.9, 0.25) * 0.12 +
    bump(t, 110.2, 0.3) * 0.22 +
    bump(t, 137.0, 0.35) * 0.75;
  if (v < 0.005) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, `rgba(255,246,214,${v})`);
  g.addColorStop(0.6, `rgba(231,196,93,${v * 0.7})`);
  g.addColorStop(1, `rgba(212,175,55,${v * 0.4})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function vignette(ctx: Ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function hud(ctx: Ctx, t: number, amb: number) {
  const a = 0.75;
  ctx.save();
  ctx.globalAlpha = a;
  const m = 46 + Math.sin(amb * 1.3) * 3;
  const L = 34;
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 1.5;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  }
  const act = ACTS.find((x) => t >= x.start && t < x.end) ?? ACTS[ACTS.length - 1];
  const actIn = prog(t, act.start, act.start + 0.8);
  text(ctx, act.label, 96, 78, 14, GOLD2, { kind: 'mono', spacing: 3, alpha: easeOut(actIn) });
  ctx.fillStyle = 'rgba(212,175,55,0.5)';
  ctx.fillRect(96, 94, 180 * easeOut(actIn), 1);

  const block = 186402117 + Math.floor(amb * 3.7);
  text(ctx, `SUI MAINNET  ·  CHECKPOINT ${block.toLocaleString('en-US')}`, W - 96, 78, 13, MUTED, { kind: 'mono', align: 'right', spacing: 2 });
  ctx.fillStyle = EMERALD;
  ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(amb * 4));
  ctx.beginPath();
  ctx.arc(W - 96 - measure(ctx, `SUI MAINNET  ·  CHECKPOINT ${block.toLocaleString('en-US')}`, 13, 'mono', 600, 2) - 16, 78, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;

  text(ctx, fmtTime(Math.min(t, FILM_DURATION)), 96, H - 78, 14, MUTED, { kind: 'mono', spacing: 2 });
  // beat dot
  const bp = (amb % BEAT) / BEAT;
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = a * (1 - bp);
  ctx.beginPath();
  ctx.arc(W - 96, H - 78, 4 + 6 * bp, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
  text(ctx, 'MIND  ·  LAUNCH FILM  ·  98 BPM', W - 120, H - 78, 13, MUTED, { kind: 'mono', align: 'right', spacing: 2 });
  // progress hairline
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(96, H - 52, W - 192, 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(96, H - 52, (W - 192) * clamp(t / FILM_DURATION), 1);
  // rotating crosshair
  ctx.save();
  ctx.translate(W - 96, 130);
  ctx.rotate(amb * 0.6);
  ctx.strokeStyle = 'rgba(212,175,55,0.4)';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function captions(ctx: Ctx, t: number) {
  const cue = VO_CUES.find((c) => t >= c.start && t <= c.start + c.duration + 0.3);
  if (!cue) return;
  const a = prog(t, cue.start, cue.start + 0.3) * (1 - prog(t, cue.start + cue.duration, cue.start + cue.duration + 0.3));
  const lines = wrap(ctx, cue.text, 1200, 26, 'sans', 500);
  const lineH = 36;
  // show a 2-line window that advances with speech progress
  const p = clamp((t - cue.start) / cue.duration);
  const idx = Math.min(lines.length - 1, Math.floor(p * lines.length));
  const start = Math.max(0, Math.min(idx, lines.length - 2));
  const shown = lines.slice(start, start + 2);
  ctx.save();
  ctx.globalAlpha = a;
  const boxH = shown.length * lineH + 26;
  const y0 = H - 150 - boxH;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 660, y0, 1320, boxH, 14);
  ctx.fill();
  shown.forEach((l, i) => text(ctx, l, W / 2, y0 + 13 + lineH / 2 + i * lineH, 26, TEXT, { align: 'center', weight: 500 }));
  ctx.restore();
}

// ---------------------------------------------------------------- ACT I: genesis
const GOAL_CARDS = [
  { tag: 'GOAL // 01', title: 'Liquidity Reserve Target', value: '$2,500,000  ·  30% STABLES' },
  { tag: 'GUARDRAIL // 02', title: 'Max Slippage Boundary', value: '0.8% PER SWAP' },
  { tag: 'LIMIT // 03', title: 'DeFi Concentration Cap', value: '25% PER PROTOCOL' },
];

function sceneGenesis(ctx: Ctx, t: number, amb: number) {
  // -- floating ephemeral hashes (0 – 13.5)
  const env = prog(t, 0, 1.2) * (1 - prog(t, 11, 13.5));
  if (env > 0) {
    for (const hsh of HASHES) {
      const q = (amb * hsh.rate + hsh.phase) % 1;
      const al = Math.sin(q * Math.PI) * env * 0.55;
      const sc = 0.75 + q * 0.6;
      const red = t > 7.6 && hsh.phase > 0.45;
      const jitter = red && Math.sin(amb * 40 + hsh.phase * 9) > 0.7 ? 6 : 0;
      ctx.save();
      ctx.translate(hsh.x * (1 + q * 0.25) + jitter, hsh.y * (1 + q * 0.25));
      ctx.scale(sc, sc);
      text(ctx, hsh.text, 0, 0, 18, red ? ROSE : 'rgba(245,230,190,1)', { kind: 'mono', align: 'center', alpha: al, spacing: 1 });
      ctx.restore();
    }
  }

  // -- the live volume counter (1.2 – 11.5)
  const cIn = prog(t, 1.2, 2.6);
  const cOut = prog(t, 10.3, 11.4);
  if (cIn > 0 && cOut < 1) {
    const vol = 1.84e9 + easeOut(prog(t, 1.2, 6.5)) * 0.64e9 + amb * 13771;
    const glitch = bump(t, 7.9, 0.35);
    const lost = easeOut(prog(t, 8.2, 8.9));
    ctx.save();
    ctx.globalAlpha = easeOut(cIn) * (1 - cOut);
    ctx.translate(0, -40 + Math.sin(amb * 0.9) * 6 - cOut * 120);
    ctx.scale(1 - cOut * 0.3, 1 - cOut * 0.3);
    text(ctx, 'ONCHAIN VALUE MOVED  ·  LAST 24H', 0, -110, 18, GOLD2, { kind: 'mono', align: 'center', spacing: 5 });
    const s = `$${Math.floor(vol).toLocaleString('en-US')}`;
    if (glitch > 0.05) {
      text(ctx, s, -8 * glitch, 0, 128, 'rgba(229,72,77,0.8)', { kind: 'display', align: 'center', weight: 700, spacing: -4, alpha: glitch });
      text(ctx, s, 8 * glitch, 0, 128, 'rgba(44,205,154,0.6)', { kind: 'display', align: 'center', weight: 700, spacing: -4, alpha: glitch });
    }
    text(ctx, s, 0, 0, 128, TEXT, { kind: 'display', align: 'center', weight: 700, spacing: -4, alpha: 1 - lost * 0.75 });
    // stamp
    if (lost > 0) {
      const sp = spring(t - 8.2);
      ctx.save();
      ctx.translate(0, 120);
      ctx.rotate(-0.04);
      ctx.scale(lerp(1.6, 1, sp), lerp(1.6, 1, sp));
      ctx.globalAlpha *= clamp(sp * 1.2);
      ctx.strokeStyle = ROSE;
      ctx.lineWidth = 2;
      const w = measure(ctx, 'CONTEXT LOST  ·  SESSION RESET', 26, 'mono', 700, 6) + 60;
      ctx.strokeRect(-w / 2, -32, w, 64);
      text(ctx, 'CONTEXT LOST  ·  SESSION RESET', 0, 1, 26, ROSE, { kind: 'mono', align: 'center', weight: 700, spacing: 6 });
      ctx.restore();
    }
    ctx.restore();
  }

  // -- orbiting goal cards that get scanned & forgotten (10.5 – 21.6)
  if (t > 10.5 && t < 22) {
    const open = spring(t - 10.8, 5, 8);
    const collapse = easeIn(prog(t, 19.4, 21.6));
    const radius = 640 * open * (1 - collapse);
    const spin = amb * 0.45 + collapse * 5;
    const order = GOAL_CARDS.map((c, i) => {
      const a = spin + (i * Math.PI * 2) / 3;
      return { c, i, a, d: Math.sin(a) };
    }).sort((p, q) => p.d - q.d);
    // golden threads from the corners
    for (const { i, a } of order) {
      const tp = easeOut(prog(t, 16.4 + i * 0.35, 17.6 + i * 0.35));
      if (tp <= 0) continue;
      const cx = Math.cos(a) * radius;
      const cy = Math.sin(a) * 130 * (1 - collapse) - 20;
      const corners: [number, number][] = [
        [-960, -540],
        [960, -540],
        [-960, 540],
        [960, 540],
      ];
      ctx.save();
      ctx.strokeStyle = GOLD2;
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.65;
      const cc = corners[(i + 1) % 4];
      const cc2 = corners[(i + 3) % 4];
      for (const [x0, y0] of [cc, cc2]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(lerp(x0, cx, tp), lerp(y0, cy, tp));
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const { c, i, a, d } of order) {
      const cx = Math.cos(a) * radius;
      const cy = Math.sin(a) * 130 * (1 - collapse) - 20;
      const sc = (0.72 + 0.28 * (d + 1) * 0.5) * lerp(1, 0.15, collapse);
      const lost = easeOut(prog(t, 12.8 + i * 1.0, 13.6 + i * 1.0));
      const saved = easeOut(prog(t, 17.2 + i * 0.35, 17.9 + i * 0.35));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.globalAlpha = clamp(open * 1.5) * (0.55 + 0.45 * (d + 1) * 0.5);
      const w = 440;
      const h = 196;
      glass(ctx, -w / 2, -h / 2, w, h, 22, {
        border: saved > 0.5 ? GOLD : lost > 0.5 ? ROSE : GOLD,
        borderAlpha: 0.35 + saved * 0.5,
        glow: saved * 24,
      });
      const contentA = 1 - lost * 0.8 + saved * 0.8;
      text(ctx, c.tag, -w / 2 + 30, -h / 2 + 38, 14, GOLD2, { kind: 'mono', spacing: 3, alpha: contentA });
      text(ctx, c.title, -w / 2 + 30, -6, 30, TEXT, { kind: 'display', weight: 600, alpha: contentA });
      text(ctx, c.value, -w / 2 + 30, 48, 17, MUTED, { kind: 'mono', spacing: 1.5, alpha: contentA });
      if (lost > 0 && saved < 1) {
        ctx.globalAlpha *= lost * (1 - saved);
        pill(ctx, w / 2 - 110, -h / 2 + 38, 'FORGOTTEN', ROSE, 12);
      }
      if (saved > 0) {
        ctx.globalAlpha = clamp(open * 1.5) * saved;
        pill(ctx, w / 2 - 110, -h / 2 + 38, 'REMEMBERED', EMERALD, 12);
      }
      ctx.restore();
    }
    // stateless red scanner beam
    const sb = prog(t, 12.4, 16.2);
    if (sb > 0 && sb < 1) {
      const x = lerp(-980, 980, sb);
      ctx.save();
      const g = ctx.createLinearGradient(x - 70, 0, x + 6, 0);
      g.addColorStop(0, 'rgba(229,72,77,0)');
      g.addColorStop(1, 'rgba(229,72,77,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70, -540, 76, 1080);
      ctx.fillStyle = ROSE;
      ctx.fillRect(x, -540, 2, 1080);
      text(ctx, 'STATELESS SCAN', x + 14, -300, 13, ROSE, { kind: 'mono', spacing: 3 });
      ctx.restore();
    }
  }

  // -- origami genesis (20.8 – 28.6)
  if (t > 20.8 && t < 28.7) {
    const drawP = easeInOut(prog(t, 20.9, 23.0));
    const fillP = easeOut(prog(t, 22.6, 24.0));
    const pop = spring(t - 22.6, 6, 9);
    const size = 290 * lerp(0.92, 1, pop);
    const ly = -96;
    // halo rings
    ctx.save();
    ctx.translate(0, ly);
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate(amb * (k % 2 ? -0.3 : 0.22) + k);
      ctx.setLineDash([4 + k * 4, 14 + k * 6]);
      ctx.strokeStyle = `rgba(212,175,55,${0.35 * drawP})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 220 + k * 44 + Math.sin(amb * 1.2 + k) * 4, 0, Math.PI * 2 * drawP);
      ctx.stroke();
      ctx.restore();
    }
    // radial bloom
    const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, 360);
    bg.addColorStop(0, `rgba(231,196,93,${0.32 * fillP})`);
    bg.addColorStop(1, 'rgba(231,196,93,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(-400, -400, 800, 800);
    ctx.restore();
    logo(ctx, 0, ly, size, amb, drawP, fillP, 1 + bump(t, 23.2, 0.6));

    // wordmark + tagline
    const word = 'MIND';
    const ws = measure(ctx, word, 88, 'display', 700, 34);
    let x = -ws / 2;
    const fade = 1 - prog(t, 26.6, 27.6);
    for (let i = 0; i < word.length; i++) {
      const s = spring(t - (23.1 + i * 0.08));
      const ch = word[i];
      const cw = measure(ctx, ch, 88, 'display', 700, 34);
      ctx.save();
      ctx.translate(x + cw / 2, 158 + (1 - s) * 60);
      ctx.globalAlpha = clamp(s) * fade;
      text(ctx, ch, 0, 0, 88, TEXT, { kind: 'display', weight: 700, align: 'center', spacing: 0 });
      ctx.restore();
      x += cw;
    }
    const tag = 'YOUR FINANCIAL LIFE, REMEMBERED.';
    const tp = prog(t, 24.0, 25.6);
    const shown = tag.slice(0, Math.floor(tag.length * tp));
    text(ctx, shown, 0, 234, 21, GOLD2, { kind: 'mono', align: 'center', spacing: 7, alpha: fade });
    if (tp > 0 && tp < 1 && Math.floor(amb * 6) % 2 === 0) {
      const sw = measure(ctx, shown, 21, 'mono', 600, 7);
      ctx.fillStyle = GOLD2;
      ctx.fillRect(sw / 2 + 4, 222, 3, 24);
    }
  }
}

// ---------------------------------------------------------------- ACT II: studio
const LAPTOP_W = 1100;
const LAPTOP_H = (LAPTOP_W * 768) / 1376;

const RIBBONS = [0, 1, 2, 3].map((i) => ({ x: -800 + i * 360, y: -270 + i * 150, w: 560, h: 104 }));
const PANEL_A = { x: -900, y: -320, w: 860, h: 690 };
const PANEL_B = { x: 40, y: -320, w: 860, h: 690 };
const ribbonMorph = (i: number, t: number) => easeInOut(prog(t, 68.6 + i * 0.12, 70.3 + i * 0.12));
const splitMorph = (i: number, t: number) => easeInOut(prog(t, 84.3 + i * 0.1, 85.7 + i * 0.1));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });

function morphRect(ctx: Ctx, r: Rect, p: number, accent = GOLD) {
  ctx.save();
  ctx.globalAlpha *= clamp(p * 4);
  glass(ctx, r.x, r.y, r.w, r.h, lerp(26, 18, p), { border: accent, borderAlpha: 0.5 + 0.3 * p, glow: 18 });
  // shutter slats
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.clip();
  const slats = 6;
  for (let k = 0; k < slats; k++) {
    const sp = clamp(p * 1.6 - k * 0.1);
    ctx.fillStyle = `rgba(212,175,55,${0.08 * (1 - Math.abs(sp - 0.5) * 2)})`;
    ctx.fillRect(r.x, r.y + (r.h / slats) * k, r.w * sp, r.h / slats - 2);
  }
  ctx.restore();
}

function laptopKey(t: number): Kf {
  return kf(t, [
    { t: 28.5, x: -40, y: 90, s: 0.26, a: 0 },
    { t: 30.8, x: -150, y: 10, s: 0.98, a: 1 },
    { t: 44.0, x: -170, y: 0, s: 1.0, a: 1 },
    { t: 46.0, x: -470, y: -40, s: 0.72, a: 1 },
    { t: 57.0, x: -480, y: -50, s: 0.74, a: 1 },
    { t: 59.0, x: 0, y: -10, s: 0.95, a: 1 },
    { t: 68.4, x: 0, y: -20, s: 0.97, a: 1 },
  ]);
}
function portfolioKey(t: number): Kf {
  return kf(t, [
    { t: 30.8, x: 120, y: -60, s: 0.55, a: 0 },
    { t: 32.0, x: 520, y: -120, s: 1.0, a: 1 },
    { t: 44.0, x: 540, y: -140, s: 1.0, a: 1 },
    { t: 46.0, x: -420, y: 290, s: 0.82, a: 1 },
    { t: 57.0, x: -400, y: 300, s: 0.82, a: 1 },
    { t: 59.0, x: -650, y: 320, s: 0.6, a: 0.85 },
    { t: 68.4, x: -640, y: 310, s: 0.62, a: 0.9 },
  ]);
}
function goalKey(i: number, t: number): Kf {
  const base = i === 0 ? { x: 460, y: -200 } : { x: 500, y: 150 };
  const side = i === 0 ? { x: 660, y: -300 } : { x: 670, y: 310 };
  return kf(t, [
    { t: 45.4 + i * 0.5, x: base.x + 520, y: base.y, s: 0.8, a: 0 },
    { t: 46.6 + i * 0.5, x: base.x, y: base.y, s: 1, a: 1 },
    { t: 57.0, x: base.x + 10, y: base.y - 6, s: 1, a: 1 },
    { t: 59.0, x: side.x, y: side.y, s: 0.6, a: 0.85 },
    { t: 68.4, x: side.x - 10, y: side.y, s: 0.62, a: 0.9 },
  ]);
}
const CARD_P = { w: 540, h: 300 };
const CARD_G = { w: 460, h: 232 };

function elemRect(k: Kf, w: number, h: number): Rect {
  return { x: k.x - (w * k.s) / 2, y: k.y - (h * k.s) / 2, w: w * k.s, h: h * k.s };
}

function drawLaptop(ctx: Ctx, t: number, amb: number, A: FilmAssets, k: Kf, alpha: number) {
  const entry = easeOut(prog(t, 28.5, 30.8));
  const roll = lerp(-0.14, 0, entry);
  const yaw = Math.sin(amb * 0.35) * 0.05 + lerp(-0.25, 0, entry);
  const pitch = lerp(0.6, 1, entry) * (1 - Math.sin(amb * 0.5) * 0.01);
  const bob = Math.sin(amb * 0.7) * 6;
  ctx.save();
  ctx.translate(k.x, k.y + bob);
  ctx.rotate(roll);
  ctx.transform(Math.cos(yaw), Math.sin(yaw) * 0.16, 0, pitch, 0, 0);
  ctx.scale(k.s, k.s);
  ctx.globalAlpha *= alpha * k.a;
  // floor reflection glow
  const fg = ctx.createRadialGradient(0, LAPTOP_H * 0.48, 10, 0, LAPTOP_H * 0.48, LAPTOP_W * 0.55);
  fg.addColorStop(0, 'rgba(212,175,55,0.22)');
  fg.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = fg;
  ctx.fillRect(-LAPTOP_W * 0.6, LAPTOP_H * 0.2, LAPTOP_W * 1.2, LAPTOP_H * 0.6);

  ctx.drawImage(A.laptopDark, -LAPTOP_W / 2, -LAPTOP_H / 2, LAPTOP_W, LAPTOP_H);

  // Alabaster theme wipe (59 – 68.3)
  const w = easeInOut(prog(t, 59.2, 63.8)) - easeInOut(prog(t, 65.6, 68.2));
  if (w > 0.001) {
    const edge = lerp(-LAPTOP_W * 0.75, LAPTOP_W * 0.75, w);
    const slant = LAPTOP_H * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-LAPTOP_W / 2 - 400, -LAPTOP_H / 2);
    ctx.lineTo(edge + slant, -LAPTOP_H / 2);
    ctx.lineTo(edge - slant, LAPTOP_H / 2);
    ctx.lineTo(-LAPTOP_W / 2 - 400, LAPTOP_H / 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(A.laptopLight, -LAPTOP_W / 2, -LAPTOP_H / 2, LAPTOP_W, LAPTOP_H);
    ctx.restore();
    // refraction seam
    ctx.save();
    ctx.strokeStyle = GOLD3;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 30;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(edge + slant, -LAPTOP_H / 2 - 30);
    ctx.lineTo(edge - slant, LAPTOP_H / 2 + 30);
    ctx.stroke();
    ctx.restore();
  }

  // specular sweep across the screen
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sp = ((amb * 0.28) % 1.4) / 1.4;
  const sx = lerp(-LAPTOP_W, LAPTOP_W, sp);
  const sg = ctx.createLinearGradient(sx - 120, -LAPTOP_H / 2, sx + 120, LAPTOP_H / 2);
  sg.addColorStop(0, 'rgba(255,240,179,0)');
  sg.addColorStop(0.5, 'rgba(255,240,179,0.09)');
  sg.addColorStop(1, 'rgba(255,240,179,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-LAPTOP_W / 2, -LAPTOP_H / 2, LAPTOP_W, LAPTOP_H * 0.8);
  ctx.restore();
  ctx.restore();
}

function drawPortfolio(ctx: Ctx, t: number, amb: number, k: Kf, alpha: number) {
  const pop = spring(t - 31.0);
  const bob = Math.sin(amb * 0.9 + 1) * 5;
  const { w, h } = CARD_P;
  ctx.save();
  ctx.translate(k.x, k.y + bob);
  ctx.scale(k.s, k.s);
  ctx.globalAlpha *= alpha * k.a * clamp(pop * 1.4);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 60 * pop;
  ctx.shadowOffsetY = 30 * pop;
  glass(ctx, -w / 2, -h / 2, w, h, 26, { glow: 10 });
  ctx.restore();
  const x0 = -w / 2 + 34;
  text(ctx, 'PORTFOLIO VALUATION  ·  LIVE', x0, -h / 2 + 40, 13, GOLD2, { kind: 'mono', spacing: 3 });
  ctx.fillStyle = EMERALD;
  ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(amb * 5);
  ctx.beginPath();
  ctx.arc(w / 2 - 36, -h / 2 + 40, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * k.a * clamp(pop * 1.4);
  const v = easeOut(prog(t, 31.6, 37.6)) * 7834644.68 + Math.max(0, t - 37.6) * 0.37;
  text(ctx, `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x0, -h / 2 + 100, 50, TEXT, {
    kind: 'display',
    weight: 700,
    spacing: -1,
  });
  // sparkline
  const sp = easeInOut(prog(t, 32.2, 36.2));
  const sx0 = x0;
  const sx1 = w / 2 - 34;
  const sy0 = 70;
  const sh = 70;
  const n = Math.max(2, Math.floor(SPARK.length * sp));
  const live = (i: number) => SPARK[i] + Math.sin(amb * 1.5 + i * 0.6) * 0.012;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = lerp(sx0, sx1, i / (SPARK.length - 1));
    const y = sy0 - live(i) * sh;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = GOLD2;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.lineTo(lerp(sx0, sx1, (n - 1) / (SPARK.length - 1)), sy0 + 10);
  ctx.lineTo(sx0, sy0 + 10);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, sy0 - sh, 0, sy0 + 10);
  fg.addColorStop(0, 'rgba(212,175,55,0.25)');
  fg.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = fg;
  ctx.shadowBlur = 0;
  ctx.fill();
  const ex = lerp(sx0, sx1, (n - 1) / (SPARK.length - 1));
  const ey = sy0 - live(n - 1) * sh;
  ctx.fillStyle = GOLD3;
  ctx.beginPath();
  ctx.arc(ex, ey, 5 + Math.sin(amb * 6) * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // badges
  const bp = spring(t - 36.4);
  ctx.save();
  ctx.globalAlpha *= clamp(bp);
  pill(ctx, x0 + 150, h / 2 - 34, '97 COIN TYPES  ·  35 TX BLOCKS', EMERALD, 12);
  pill(ctx, w / 2 - 80, h / 2 - 34, '+2.41% 7D', GOLD2, 12);
  ctx.restore();
  ctx.restore();
}

function drawGoal(ctx: Ctx, i: number, t: number, amb: number, k: Kf, alpha: number) {
  const { w, h } = CARD_G;
  const bob = Math.sin(amb * 0.8 + i * 2.1) * 5;
  ctx.save();
  ctx.translate(k.x, k.y + bob);
  ctx.scale(k.s, k.s);
  ctx.globalAlpha *= alpha * k.a;
  glass(ctx, -w / 2, -h / 2, w, h, 24, { glow: 8 });
  const x0 = -w / 2 + 30;
  if (i === 0) {
    text(ctx, 'GOAL 01  ·  LIQUID RESERVE', x0, -h / 2 + 38, 12, GOLD2, { kind: 'mono', spacing: 3 });
    text(ctx, 'Maintain a $2.5M', x0, -18, 27, TEXT, { kind: 'display' });
    text(ctx, 'reserve buffer', x0, 16, 27, TEXT, { kind: 'display' });
    const rp = easeOut(prog(t, 47.0, 51.4)) * 0.942;
    ring(ctx, w / 2 - 80, 4, 50, rp, GOLD2, 8);
    text(ctx, `${(rp * 100).toFixed(1)}%`, w / 2 - 80, 4, 18, TEXT, { kind: 'mono', align: 'center' });
    text(ctx, 'FUNDED  ·  TRACKED EVERY BLOCK', x0, h / 2 - 34, 12, MUTED, { kind: 'mono', spacing: 2 });
  } else {
    text(ctx, 'GOAL 02  ·  GUARDRAIL', x0, -h / 2 + 38, 12, GOLD2, { kind: 'mono', spacing: 3 });
    text(ctx, 'Cap single-protocol drift at 25%', x0, -14, 25, TEXT, { kind: 'display' });
    const bx = x0;
    const bw = w - 60;
    const by = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 10, 5);
    ctx.fill();
    const cur = easeOut(prog(t, 47.5, 51.0)) * 0.186 + Math.sin(amb * 0.8) * 0.004;
    ctx.fillStyle = EMERALD;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * (cur / 0.4), 10, 5);
    ctx.fill();
    ctx.fillStyle = ROSE;
    ctx.fillRect(bx + bw * (0.25 / 0.4) - 1, by - 8, 2, 26);
    text(ctx, `${(cur * 100).toFixed(1)}% NOW`, bx, by + 30, 12, EMERALD, { kind: 'mono', spacing: 1 });
    text(ctx, 'LIMIT 25%', bx + bw * (0.25 / 0.4) + 8, by + 30, 12, ROSE, { kind: 'mono', spacing: 1 });
    const pb = spring(t - 51.4);
    ctx.save();
    ctx.globalAlpha *= clamp(pb) * (0.75 + 0.25 * Math.sin(amb * 3));
    pill(ctx, w / 2 - 110, -h / 2 + 38, 'WALRUS POLICY', EMERALD, 11);
    ctx.restore();
  }
  ctx.restore();
}

function sceneStudio(ctx: Ctx, t: number, amb: number, A: FilmAssets) {
  if (t < 28.4 || t > 71.2) return;
  const lk = laptopKey(t);
  const pk = portfolioKey(t);
  const gk = [goalKey(0, t), goalKey(1, t)];
  const m = [0, 1, 2, 3].map((i) => ribbonMorph(i, t));

  // top telemetry ticker
  const tk = prog(t, 29.5, 31) * (1 - prog(t, 66, 68.5));
  if (tk > 0) {
    ctx.save();
    ctx.globalAlpha = tk;
    const y = -402;
    ctx.beginPath();
    ctx.roundRect(-720, y - 20, 1440, 40, 20);
    ctx.clip();
    ctx.fillStyle = 'rgba(15,14,12,0.72)';
    ctx.fillRect(-720, y - 20, 1440, 40);
    const msg =
      'CHECKPOINT 4btiuiMP  ·  TATUM gRPC STREAM  ·  SUI MAINNET  ·  97 COIN TYPES  ·  35 TX BLOCKS  ·  WALRUS NAMESPACE mind-prod  ·  SEAL ENCRYPTED  ·  ';
    const mw = measure(ctx, msg, 13, 'mono', 600, 2);
    const off = -((amb * 90) % mw);
    for (let k = 0; k < 3; k++) text(ctx, msg, -720 + off + k * mw, y + 1, 13, GOLD2, { kind: 'mono', spacing: 2 });
    ctx.restore();
  }

  // theme chips during the wipe
  const chips = prog(t, 59.2, 60.2) * (1 - prog(t, 67.5, 68.4));
  if (chips > 0) {
    ctx.save();
    ctx.globalAlpha = chips;
    const w = easeInOut(prog(t, 59.2, 63.8)) - easeInOut(prog(t, 65.6, 68.2));
    pill(ctx, -150, -345, 'OBSIDIAN', w < 0.5 ? GOLD : MUTED, 15, w < 0.5);
    pill(ctx, 150, -345, 'ALABASTER', w >= 0.5 ? IVORY : MUTED, 15, w >= 0.5);
    ctx.restore();
  }

  // connectors (portfolio -> goals)
  const conn = prog(t, 47.4, 49.4) * (1 - prog(t, 56.5, 58));
  if (conn > 0) {
    const pr = elemRect(pk, CARD_P.w, CARD_P.h);
    const sx = pr.x + pr.w;
    const sy = pr.y + pr.h * 0.3;
    gk.forEach((g, i) => {
      const gr = elemRect(g, CARD_G.w, CARD_G.h);
      const ex = gr.x;
      const ey = gr.y + gr.h / 2;
      const c1x = sx + 260;
      const c2x = ex - 260;
      ctx.save();
      ctx.strokeStyle = GOLD2;
      ctx.lineWidth = 2;
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.8 * clamp(conn * 2);
      const total = 1200;
      ctx.setLineDash([total * easeOut(conn), total]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(c1x, sy, c2x, ey, ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      // travelling packets
      for (let q = 0; q < 3; q++) {
        const u = (amb * 0.45 + q / 3 + i * 0.17) % 1;
        const bx = Math.pow(1 - u, 3) * sx + 3 * Math.pow(1 - u, 2) * u * c1x + 3 * (1 - u) * u * u * c2x + u * u * u * ex;
        const byy = Math.pow(1 - u, 3) * sy + 3 * Math.pow(1 - u, 2) * u * sy + 3 * (1 - u) * u * u * ey + u * u * u * ey;
        ctx.fillStyle = GOLD3;
        ctx.globalAlpha = conn;
        ctx.beginPath();
        ctx.arc(bx, byy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.save();
    ctx.globalAlpha = conn;
    pill(ctx, 40, -10 + Math.sin(amb) * 6, '+1.8% ALIGNMENT DELTA', GOLD2, 13);
    ctx.restore();
  }

  // elements (fade as they morph into ribbons)
  drawLaptop(ctx, t, amb, A, lk, 1 - clamp(m[0] * 2));
  gk.forEach((g, i) => {
    if (t > 45.3 + i * 0.5) drawGoal(ctx, i, t, amb, g, 1 - clamp(m[i + 2] * 2));
  });
  if (t > 30.8) drawPortfolio(ctx, t, amb, pk, 1 - clamp(m[1] * 2));

  // relay handoff: elements compress into the 4 pipeline ribbons
  const rects = [
    { x: lk.x - (LAPTOP_W * lk.s) / 2, y: lk.y - (LAPTOP_H * lk.s) / 2, w: LAPTOP_W * lk.s, h: LAPTOP_H * lk.s },
    elemRect(pk, CARD_P.w, CARD_P.h),
    elemRect(gk[0], CARD_G.w, CARD_G.h),
    elemRect(gk[1], CARD_G.w, CARD_G.h),
  ];
  for (let i = 0; i < 4; i++) {
    if (m[i] > 0 && m[i] < 1) morphRect(ctx, lerpRect(rects[i], RIBBONS[i], m[i]), m[i]);
  }
}

// ---------------------------------------------------------------- ACT III: engine
const STAGES = [
  { n: '01', title: 'OBSERVE', sub: 'TATUM gRPC  ·  SUI MAINNET STATE', metric: '97 TOKENS' },
  { n: '02', title: 'RECALL', sub: 'WALRUS BLOBS  ·  SEAL DECRYPT', metric: '3 MEMORIES' },
  { n: '03', title: 'REASON', sub: 'GROQ  ·  openai/gpt-oss-120b', metric: '412 TOK/S' },
  { n: '04', title: 'REMEMBER', sub: 'Ed25519 SIGNED  ·  WALRUS COMMIT', metric: 'CERTIFIED' },
];

function sceneEngine(ctx: Ctx, t: number, amb: number) {
  if (t < 68.6 || t > 86.2) return;
  const track = easeInOut(prog(t, 70.4, 84.5));
  const ox = lerp(60, -60, track);
  const oy = lerp(40, -30, track);
  ctx.save();
  ctx.translate(ox * (1 - splitMorph(0, t)), oy * (1 - splitMorph(0, t)));

  // conduits
  const ca = prog(t, 70.6, 71.6) * (1 - prog(t, 84.2, 84.8));
  if (ca > 0) {
    for (let i = 0; i < 3; i++) {
      const a = RIBBONS[i];
      const b = RIBBONS[i + 1];
      const x0 = a.x + a.w - 80;
      const y0 = a.y + a.h;
      const x1 = b.x + 60;
      const y1 = b.y;
      const midY = (y0 + y1) / 2;
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, midY);
      ctx.lineTo(x1, midY);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const segs = [Math.abs(midY - y0), Math.abs(x1 - x0), Math.abs(y1 - midY)];
      const total = segs[0] + segs[1] + segs[2];
      for (let q = 0; q < 4; q++) {
        let d = ((amb * 240 + q * (total / 4) + i * 37) % total) as number;
        let px = x0;
        let py = y0;
        if (d < segs[0]) py = y0 + d;
        else if ((d -= segs[0]) < segs[1]) {
          py = midY;
          px = x0 + Math.sign(x1 - x0) * d;
        } else {
          d -= segs[1];
          px = x1;
          py = midY + d;
        }
        ctx.fillStyle = GOLD3;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ribbons
  const active = Math.floor(Math.max(0, amb - 71) / 1.4) % 4;
  for (let i = 0; i < 4; i++) {
    if (ribbonMorph(i, t) < 1) continue;
    const sm = splitMorph(i, t);
    const target = i < 2 ? PANEL_A : PANEL_B;
    const r = lerpRect(RIBBONS[i], target, sm);
    const bob = Math.sin(amb * 0.9 + i) * 4 * (1 - sm);
    if (sm > 0) {
      morphRect(ctx, { ...r, y: r.y + bob }, 1, i < 2 ? ROSE : GOLD);
    } else {
      const isActive = i === active;
      glass(ctx, r.x, r.y + bob, r.w, r.h, 18, { border: GOLD, borderAlpha: isActive ? 0.9 : 0.45, glow: isActive ? 26 : 10 });
    }
    const ca2 = prog(t, 70.4 + i * 0.12, 71.2 + i * 0.12) * (1 - clamp(sm * 3));
    if (ca2 <= 0) continue;
    ctx.save();
    ctx.globalAlpha = ca2;
    const y = r.y + bob + r.h / 2;
    ctx.fillStyle = 'rgba(212,175,55,0.12)';
    ctx.beginPath();
    ctx.arc(r.x + 52, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x + 52, y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((amb * 0.5 + i * 0.25) % 1));
    ctx.stroke();
    text(ctx, STAGES[i].n, r.x + 52, y + 1, 15, GOLD2, { kind: 'mono', align: 'center' });
    text(ctx, STAGES[i].title, r.x + 98, y - 14, 28, TEXT, { kind: 'display', weight: 700, spacing: 3 });
    text(ctx, STAGES[i].sub, r.x + 98, y + 20, 12, MUTED, { kind: 'mono', spacing: 1.5 });
    text(ctx, STAGES[i].metric, r.x + r.w - 26, y, 14, i === active ? EMERALD : GOLD2, { kind: 'mono', align: 'right', spacing: 2 });
    ctx.restore();
  }

  // memory capsule (77.5 – 85.6) — flies into Mode B panel on split
  const capIn = spring(t - 77.6);
  const capFly = easeInOut(prog(t, 84.3, 85.6));
  if (t > 77.6 && capFly < 1) {
    const cw = 640;
    const ch = 210;
    const cx = lerp(-560, PANEL_B.x + PANEL_B.w / 2, capFly);
    const cy = lerp(300, PANEL_B.y + PANEL_B.h * 0.55, capFly);
    ctx.save();
    ctx.translate(cx, cy + Math.sin(amb * 1.1) * 5);
    ctx.scale(lerp(0.85, 1, capIn) * (1 - capFly * 0.7), lerp(0.85, 1, capIn) * (1 - capFly * 0.7));
    ctx.globalAlpha = clamp(capIn) * (1 - capFly);
    glass(ctx, -cw / 2, -ch / 2, cw, ch, 22, { border: EMERALD, borderAlpha: 0.55, glow: 16 });
    text(ctx, 'MEMORY CAPSULE  ·  mem_walrus_9f4a', -cw / 2 + 28, -ch / 2 + 34, 13, GOLD2, { kind: 'mono', spacing: 2 });
    const enc = prog(t, 78.5, 81.4);
    const locked = Math.floor(enc * 32);
    const rr = rng(Math.floor(amb * 18));
    font(ctx, 20, 'mono', 600);
    let row = '';
    for (let k = 0; k < 32; k++) row += k < locked ? '9f4a2c71e0b38d5a6c14f2e97b0d3a81'[k] : HEX[Math.floor(rr() * 16)];
    const x0 = -cw / 2 + 28;
    for (let k = 0; k < 32; k++) {
      text(ctx, row[k], x0 + k * 18, -18, 20, k < locked ? GOLD3 : 'rgba(245,242,234,0.3)', { kind: 'mono' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x0, 14, cw - 56, 4);
    ctx.fillStyle = EMERALD;
    ctx.fillRect(x0, 14, (cw - 56) * enc, 4);
    const sealP = prog(t, 81.4, 81.9);
    check(ctx, x0 + 10, 52, 20, EMERALD, sealP);
    text(ctx, 'SEAL ENVELOPE', x0 + 34, 52, 15, sealP > 0 ? TEXT : MUTED, { kind: 'mono', spacing: 2 });
    text(ctx, 'Ed25519  0x9c41...e2b7', x0 + 250, 52, 15, MUTED, { kind: 'mono', spacing: 1 });
    const cert = spring(t - 82.2);
    if (cert > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(cert);
      pill(ctx, cw / 2 - 134, -ch / 2 + 34, 'CERTIFIED  ·  mind-prod', EMERALD, 12, true);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- ACT III: memory replay A/B
const ANSWER_A = 'Yes. Leveraged SUI pools are yielding 18 to 24% APY right now. Deploy your full idle balance to maximise returns while rates are high.';
const ANSWER_B =
  'Hold. Your $2.5M reserve is 94.2% funded, and leveraged pools would breach your 25% drift cap. Stage 10% into audited lending instead, keeping the buffer intact.';
const PILLS = ['RESERVE POLICY  ·  $2.5M', 'LESSON  ·  SLIPPAGE, AUG 2025', 'RISK PROFILE  ·  CONSERVATIVE'];

function gauge(ctx: Ctx, cx: number, cy: number, r: number, v: number, color: string, label: string) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * (v / 100));
  ctx.stroke();
  ctx.restore();
  text(ctx, `${Math.round(v)}`, cx, cy - 4, 40, TEXT, { kind: 'display', align: 'center', weight: 700 });
  text(ctx, label, cx, cy + 34, 11, MUTED, { kind: 'mono', align: 'center', spacing: 2 });
}

function typed(ctx: Ctx, s: string, p: number, x: number, y: number, maxW: number, size: number, color: string, amb: number) {
  const lines = wrap(ctx, s, maxW, size, 'sans', 500);
  let remaining = Math.floor(s.length * p);
  const lh = size * 1.5;
  lines.forEach((l, i) => {
    if (remaining <= 0) return;
    const part = l.slice(0, remaining);
    remaining -= l.length + 1;
    text(ctx, part, x, y + i * lh, size, color, { weight: 500 });
    if (remaining <= 0 && p < 1 && Math.floor(amb * 6) % 2 === 0) {
      const w = measure(ctx, part, size, 'sans', 500);
      ctx.fillStyle = color;
      ctx.fillRect(x + w + 3, y + i * lh - size / 2, 2, size);
    }
  });
}

function sceneReplay(ctx: Ctx, t: number, amb: number) {
  if (t < 85.6 || t > 110.4) return;
  const exit = easeInOut(prog(t, 107.6, 110.2));
  const panelsA = (1 - clamp(exit * 1.3)) * prog(t, 85.75, 86.1);

  // header prompt
  ctx.save();
  ctx.globalAlpha = prog(t, 85.9, 86.6) * panelsA;
  text(ctx, 'MEMORY REPLAY  ·  SAME PROMPT, TWO MINDS', 0, -430, 14, GOLD2, { kind: 'mono', align: 'center', spacing: 4 });
  const q = 'Should I deploy my idle SUI into leveraged yield pools?';
  const qp = prog(t, 86.2, 88.4);
  text(ctx, q.slice(0, Math.floor(q.length * qp)), 0, -385, 30, TEXT, { kind: 'display', align: 'center', weight: 600 });
  ctx.restore();

  const drawPanel = (r: Rect, side: 'A' | 'B') => {
    const dx = (side === 'A' ? -1 : 1) * exit * 520;
    ctx.save();
    ctx.translate(dx, Math.sin(amb * 0.7 + (side === 'A' ? 0 : 2)) * 4);
    ctx.globalAlpha = panelsA;
    const accent = side === 'A' ? ROSE : GOLD;
    glass(ctx, r.x, r.y, r.w, r.h, 18, { border: accent, borderAlpha: 0.55, glow: side === 'B' ? 14 + 10 * Math.sin(amb * 2) : 6 });
    const x0 = r.x + 40;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x0 + 6, r.y + 46, 6, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, side === 'A' ? 'MODE A  ·  STATELESS' : 'MODE B  ·  WALRUS MEMORY', x0 + 24, r.y + 46, 16, accent, { kind: 'mono', spacing: 3 });
    text(ctx, side === 'A' ? 'No memory context' : '3 encrypted memories recalled', x0, r.y + 84, 15, MUTED, { kind: 'mono', spacing: 1 });
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x0, r.y + 110, r.w - 80, 1);

    if (side === 'A') {
      typed(ctx, ANSWER_A, prog(t, 88.6, 94.6), x0, r.y + 160, r.w - 80, 24, 'rgba(245,242,234,0.85)', amb);
      const gv = easeOut(prog(t, 94.4, 96.4)) * 18;
      gauge(ctx, r.x + r.w / 2, r.y + r.h - 150, 74, gv, ROSE, 'PERSONALIZATION');
      const fl = spring(t - 95.2);
      if (fl > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp(fl) * (0.6 + 0.4 * Math.sin(amb * 5));
        pill(ctx, r.x + r.w / 2, r.y + r.h - 40, 'IGNORES RESERVE POLICY', ROSE, 12);
        ctx.restore();
      }
    } else {
      // memory pills light up as the laser passes
      const lp = prog(t, 92.0, 95.6);
      PILLS.forEach((p, i) => {
        const px = x0 + 10 + i * 0;
        const py = r.y + 150 + i * 46;
        const on = lp > 0.18 + i * 0.25;
        const sp = spring(t - (92.0 + (0.18 + i * 0.25) * 3.6));
        ctx.save();
        ctx.globalAlpha *= on ? clamp(sp) : 0.18;
        const w = measure(ctx, p, 13, 'mono', 600, 1.5) + 34;
        ctx.translate(px + w / 2, py);
        pill(ctx, 0, 0, p, on ? GOLD2 : MUTED, 13);
        ctx.restore();
      });
      typed(ctx, ANSWER_B, prog(t, 99.6, 106.0), x0, r.y + 320, r.w - 80, 24, TEXT, amb);
      const gv = easeOut(prog(t, 101.0, 105.0)) * 96;
      gauge(ctx, r.x + r.w / 2, r.y + r.h - 150, 74, gv, GOLD2, 'PERSONALIZATION');
      const lift = spring(t - 105.0);
      if (lift > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp(lift);
        ctx.translate(r.x + r.w / 2, r.y + r.h - 40);
        ctx.scale(lerp(1.4, 1, clamp(lift)), lerp(1.4, 1, clamp(lift)));
        pill(ctx, 0, 0, '+78 PT MEMORY LIFT', EMERALD, 13, true);
        ctx.restore();
      }
      // laser
      if (lp > 0 && lp < 1) {
        const lx = lerp(r.x, r.x + r.w, lp);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(lx - 90, 0, lx, 0);
        g.addColorStop(0, 'rgba(44,205,154,0)');
        g.addColorStop(1, 'rgba(231,196,93,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(lx - 90, r.y, 90, r.h);
        ctx.fillStyle = GOLD3;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 20;
        ctx.fillRect(lx - 1, r.y - 20, 3, r.h + 40);
        ctx.restore();
      }
    }
    ctx.restore();
  };
  drawPanel(PANEL_A, 'A');
  drawPanel(PANEL_B, 'B');

  // the divider: a vertical gold line that bends into the orbit ring
  const dIn = easeOut(prog(t, 85.8, 86.8));
  const k = exit;
  const L0 = PANEL_A.h;
  const Rf = 230;
  const L = lerp(L0, Math.PI * 2 * Rf, k) * dIn;
  const midY = lerp(PANEL_A.y + PANEL_A.h / 2, 0, k);
  ctx.save();
  ctx.strokeStyle = GOLD2;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 18;
  ctx.lineWidth = lerp(2, 3, k);
  ctx.beginPath();
  if (k < 0.01) {
    ctx.moveTo(0, midY - L / 2);
    ctx.lineTo(0, midY + L / 2);
  } else {
    const theta = Math.PI * 2 * k;
    const r = L / theta;
    const cx = r + lerp(0, -Rf, k);
    ctx.arc(cx, midY, r, Math.PI - theta / 2, Math.PI + theta / 2);
  }
  ctx.stroke();
  // pulse node travelling on the divider
  if (k < 0.05) {
    const u = (amb * 0.4) % 1;
    ctx.fillStyle = GOLD3;
    ctx.beginPath();
    ctx.arc(0, midY - L / 2 + L * u, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- ACT IV: orbit + proof
const NODES = [
  { name: 'Sui Mainnet', sub: 'CHECKPOINT STREAM', ring: 0, base: 0.25, speed: 0.14, at: 117.4 },
  { name: 'Tatum', sub: 'gRPC INDEXER', ring: 1, base: 1.51, speed: 0.14, at: 118.7 },
  { name: 'Walrus', sub: 'BLOB STORE  ·  mind-prod', ring: 2, base: 2.76, speed: 0.14, at: 119.8 },
  { name: 'SEAL', sub: 'CLIENT-SIDE ENCRYPTION', ring: 1, base: 4.02, speed: 0.14, at: 121.0 },
  { name: 'Groq', sub: 'gpt-oss-120b  ·  LPU', ring: 2, base: 5.28, speed: 0.14, at: 122.6 },
];
const RING_R = [230, 370, 510];
const PROOFS = [
  { big: '100% LIVE MAINNET', sub: '97 VERIFIED COIN TYPES  ·  $7.83M INDEXED', at: 125.8 },
  { big: 'WALRUS + SEAL PRIVACY', sub: 'CLIENT-SIDE ENCRYPTED  ·  Ed25519 SIGNED', at: 129.3 },
  { big: 'PROVEN MEMORY LIFT', sub: '+78 PT PERSONALIZATION IN MEMORY REPLAY', at: 132.6 },
];

function sceneOrbit(ctx: Ctx, t: number, amb: number) {
  if (t < 109.9 || t > 137.4) return;
  const tilt = easeInOut(prog(t, 110.0, 113.0));
  const prism = easeIn(prog(t, 135.3, 137.1));
  const proofPhase = easeInOut(prog(t, 124.8, 126.2));
  const sy = lerp(1, 0.42, tilt) * lerp(1, 0.04, prism);
  const sx = lerp(1, 0.3, prism);
  const pull = lerp(1, 0.86, tilt) * lerp(1, 0.92, proofPhase);
  ctx.save();
  ctx.translate(0, lerp(0, 60, proofPhase));
  ctx.scale(pull * sx, pull);
  ctx.globalAlpha = lerp(1, 0.45, proofPhase);

  // gravitational beat waves
  const wp = (amb % BEAT) / BEAT;
  for (let k = 0; k < 2; k++) {
    const p = (wp + k * 0.5) % 1;
    ctx.save();
    ctx.strokeStyle = `rgba(212,175,55,${0.35 * (1 - p) * tilt})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 90 + p * 620, (90 + p * 620) * sy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // rings
  RING_R.forEach((r0, i) => {
    const grow = i === 0 ? prog(t, 110.0, 110.25) : spring(t - (110.3 + i * 0.35), 5, 8);
    const r = r0 * clamp(grow, 0, 1.15);
    if (r <= 1) return;
    ctx.save();
    ctx.strokeStyle = i === 0 ? GOLD2 : 'rgba(212,175,55,0.55)';
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = i === 0 ? 18 : 6;
    ctx.lineWidth = i === 0 ? 3 : 1.4;
    ctx.setLineDash(i === 0 ? [] : [6 + i * 4, 12 + i * 4]);
    ctx.lineDashOffset = amb * (i % 2 ? -40 : 30);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * sy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  const nodePos = NODES.map((n) => {
    const a = n.base + amb * n.speed;
    const r = RING_R[n.ring];
    return { n, a, x: Math.cos(a) * r, y: Math.sin(a) * r * sy, front: Math.sin(a) > 0 };
  });

  const drawNode = (p: (typeof nodePos)[number]) => {
    const s = spring(t - p.n.at);
    if (s <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(s);
    // link to core
    ctx.strokeStyle = `rgba(212,175,55,${0.18 + 0.12 * Math.sin(amb * 3 + p.a)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.translate(p.x, p.y);
    const depth = p.front ? 1 : 0.78;
    ctx.scale(depth * lerp(1.5, 1, clamp(s)), depth * lerp(1.5, 1, clamp(s)));
    ctx.fillStyle = GOLD3;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const w = Math.max(measure(ctx, p.n.name, 22, 'display', 700), measure(ctx, p.n.sub, 11, 'mono', 600, 1.5)) + 40;
    glass(ctx, -w / 2, 22, w, 66, 14, { borderAlpha: 0.5, shadow: false });
    text(ctx, p.n.name, 0, 46, 22, TEXT, { kind: 'display', weight: 700, align: 'center' });
    text(ctx, p.n.sub, 0, 72, 11, GOLD2, { kind: 'mono', align: 'center', spacing: 1.5 });
    ctx.restore();
  };

  nodePos.filter((p) => !p.front).forEach(drawNode);
  // core
  const core = 1 + Math.sin(amb * 1.6) * 0.03;
  const cg = ctx.createRadialGradient(0, 0, 10, 0, 0, 220);
  cg.addColorStop(0, 'rgba(231,196,93,0.45)');
  cg.addColorStop(1, 'rgba(231,196,93,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(-240, -240, 480, 480);
  logo(ctx, 0, 0, 170 * core * spring(t - 110.1, 5, 8), amb, 1, 1, 1.2);
  nodePos.filter((p) => p.front).forEach(drawNode);
  ctx.restore();

  // kinetic proof monuments
  if (t > 125.5) {
    ctx.save();
    ctx.scale(lerp(1, 0.3, prism), lerp(1, 0.04, prism));
    PROOFS.forEach((p, i) => {
      const s = spring(t - p.at, 6, 9);
      if (s <= 0) return;
      const next = PROOFS[i + 1];
      const stack = next ? easeInOut(prog(t, next.at - 0.3, next.at + 0.6)) : 0;
      const slotY = -330 + i * 64;
      const y = lerp(40, slotY, stack);
      const sc = lerp(lerp(1.5, 1, clamp(s)), 0.34, stack);
      ctx.save();
      ctx.translate(Math.sin(amb * 0.6 + i) * 6, y);
      ctx.scale(sc, sc);
      ctx.globalAlpha = clamp(s * 1.3) * lerp(1, 0.75, stack);
      const spacing = lerp(30, 2, clamp(s));
      text(ctx, p.big, 0, 0, 118, TEXT, { kind: 'display', weight: 800, align: 'center', spacing });
      // underline sweep
      const bw = measure(ctx, p.big, 118, 'display', 800, spacing);
      const up = easeOut(prog(t, p.at + 0.2, p.at + 1.2));
      const ug = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      ug.addColorStop(0, 'rgba(212,175,55,0)');
      ug.addColorStop(0.5, GOLD2);
      ug.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = ug;
      ctx.fillRect((-bw / 2) * up, 72, bw * up, 3);
      text(ctx, p.sub, 0, 118, 22, GOLD2, { kind: 'mono', align: 'center', spacing: 5, alpha: (1 - stack) * up });
      ctx.restore();
    });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- ACT V: finale
const FRAMES = ['DASHBOARD', 'WALLET INTELLIGENCE', 'MEMORY REPLAY', 'ASK MIND'];

function miniUI(ctx: Ctx, i: number, w: number, h: number, amb: number) {
  const x0 = -w / 2 + 22;
  const y0 = -h / 2 + 64;
  const iw = w - 44;
  if (i === 0) {
    ctx.beginPath();
    for (let k = 0; k < SPARK.length; k++) {
      const x = x0 + (iw * k) / (SPARK.length - 1);
      const y = y0 + 70 - (SPARK[k] + Math.sin(amb * 1.5 + k * 0.5) * 0.02) * 60;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = GOLD2;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(x0 + k * (iw / 2 + 4), y0 + 86, iw / 2 - 4, 42, 8);
      ctx.fill();
    }
    text(ctx, '$7.83M', x0 + 12, y0 + 107, 16, TEXT, { kind: 'display', weight: 700 });
    text(ctx, '97 TOKENS', x0 + iw / 2 + 16, y0 + 107, 12, EMERALD, { kind: 'mono' });
  } else if (i === 1) {
    const vals = [0.62, 0.44, 0.3, 0.18];
    vals.forEach((v, k) => {
      const ww = iw * (v + Math.sin(amb + k) * 0.03);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x0, y0 + k * 32, iw, 14);
      ctx.fillStyle = k === 0 ? GOLD2 : k === 3 ? EMERALD : 'rgba(212,175,55,0.6)';
      ctx.fillRect(x0, y0 + k * 32, ww, 14);
    });
  } else if (i === 2) {
    const a = 0.18 + Math.sin(amb) * 0.02;
    const b = 0.96 - Math.sin(amb * 1.2) * 0.02;
    [a, b].forEach((v, k) => {
      const bx = x0 + k * (iw / 2 + 6);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(bx, y0, iw / 2 - 6, 110);
      ctx.fillStyle = k ? GOLD2 : ROSE;
      ctx.fillRect(bx + 14, y0 + 110 - 100 * v, iw / 2 - 34, 100 * v);
      text(ctx, k ? 'B' : 'A', bx + 10, y0 + 14, 12, TEXT, { kind: 'mono' });
    });
  } else {
    const bubbles: [number, number, boolean][] = [
      [0.7, 0, false],
      [0.55, 1, true],
      [0.8, 2, false],
    ];
    bubbles.forEach(([bw, k, me]) => {
      const ww = iw * bw;
      const bx = me ? x0 + iw - ww : x0;
      ctx.fillStyle = me ? 'rgba(212,175,55,0.35)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(bx, y0 + k * 40 + Math.sin(amb * 2 + k) * 1.5, ww, 30, 10);
      ctx.fill();
    });
  }
}

function sceneFinale(ctx: Ctx, t: number, amb: number) {
  if (t < 136.6) return;
  const bloom = spring(t - 136.9, 5, 7);
  const ly = -150;

  // rotating rays
  ctx.save();
  ctx.translate(0, ly);
  ctx.rotate(amb * 0.05);
  ctx.globalAlpha = clamp(bloom) * 0.5;
  for (let k = 0; k < 28; k++) {
    ctx.rotate((Math.PI * 2) / 28);
    const g = ctx.createLinearGradient(0, 0, 0, -900);
    g.addColorStop(0, 'rgba(231,196,93,0.18)');
    g.addColorStop(1, 'rgba(231,196,93,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(26, -900);
    ctx.lineTo(-26, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // bento halo (multi-frame pullback: frames start huge and settle into wide peripheral wing halo)
  const pull = easeOut(prog(t, 137.3, 140.6));
  const wingTargets: [number, number][] = [
    [-690, -245],
    [690, -245],
    [-640, -15],
    [640, -15],
  ];
  FRAMES.forEach((label, i) => {
    const fw = 320;
    const fh = 196;
    const [tx, ty] = wingTargets[i];
    const ox = tx + Math.sin(amb * 0.7 + i * 1.4) * 14;
    const oy = ty + Math.cos(amb * 0.6 + i * 1.1) * 10;
    const startX = (i % 2 ? 1 : -1) * 1350;
    const startY = (i < 2 ? -1 : 1) * 820;
    ctx.save();
    ctx.translate(lerp(startX, ox, pull), lerp(startY, oy, pull));
    const sc = lerp(2.4, 0.88, pull);
    ctx.scale(sc, sc);
    ctx.globalAlpha = clamp(pull * 2) * 0.88;
    glass(ctx, -fw / 2, -fh / 2, fw, fh, 18, { borderAlpha: 0.45 });
    text(ctx, label, -fw / 2 + 22, -fh / 2 + 28, 11, GOLD2, { kind: 'mono', spacing: 2 });
    miniUI(ctx, i, fw, fh, amb);
    ctx.restore();
  });

  // monolith logo
  const lg = ctx.createRadialGradient(0, ly, 20, 0, ly, 380);
  lg.addColorStop(0, `rgba(231,196,93,${0.45 * clamp(bloom)})`);
  lg.addColorStop(1, 'rgba(231,196,93,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(-420, ly - 420, 840, 840);
  logo(ctx, 0, ly, 260 * clamp(bloom, 0, 1.2) * (1 + Math.sin(amb * 1.2) * 0.015), amb, 1, 1, 1.4);

  // wordmark
  const wm = spring(t - 140.2);
  if (wm > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(wm);
    text(ctx, 'MIND', 0, ly + 210 + (1 - wm) * 30, 40, GOLD2, { kind: 'display', weight: 700, align: 'center', spacing: lerp(40, 18, clamp(wm)) });
    ctx.restore();
  }

  // headline letter-by-letter
  const head = 'Your financial life, remembered.';
  const hw = measure(ctx, head, 66, 'display', 700, -1);
  let x = -hw / 2;
  for (let i = 0; i < head.length; i++) {
    const ch = head[i];
    const cw = measure(ctx, ch, 66, 'display', 700, -1);
    const s = spring(t - (141.5 + i * 0.035));
    if (s > 0) {
      ctx.save();
      ctx.translate(x + cw / 2, 190 + (1 - s) * 40);
      ctx.globalAlpha = clamp(s);
      text(ctx, ch, 0, 0, 66, i > 20 ? GOLD3 : TEXT, { kind: 'display', weight: 700, align: 'center', spacing: -1 });
      ctx.restore();
    }
    x += cw;
  }

  // CTA pills
  const pills: [string, number, boolean][] = [
    ['mind-hazel.vercel.app', 143.5, true],
    ['mind-production-14a9.up.railway.app', 144.1, false],
    ['github.com/OpeyemiMoses/MIND', 144.7, false],
  ];
  const widths = pills.map(([l]) => measure(ctx, l, 17, 'mono', 600, 1.5) + 34);
  const gap = 26;
  const total = widths.reduce((a, b) => a + b, 0) + gap * 2;
  let px = -total / 2;
  pills.forEach(([label, at, primary], i) => {
    const s = spring(t - at);
    const w = widths[i];
    if (s > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(s);
      ctx.translate(px + w / 2, 300 + (1 - clamp(s)) * 30);
      if (primary) {
        const aura = 0.5 + 0.5 * Math.sin(amb * 3);
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 20 + aura * 30;
      }
      pill(ctx, 0, 0, label, primary ? GOLD2 : TEXT, 17, primary);
      ctx.restore();
    }
    px += w + gap;
  });

  const live = prog(t, 145.4, 146.2);
  if (live > 0) {
    ctx.save();
    ctx.globalAlpha = live;
    ctx.fillStyle = EMERALD;
    ctx.globalAlpha = live * (0.5 + 0.5 * Math.sin(amb * 4));
    ctx.beginPath();
    ctx.arc(-120, 372, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = live;
    text(ctx, 'LIVE ON SUI MAINNET', -102, 372, 14, EMERALD, { kind: 'mono', spacing: 3 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- camera + compositor
function camera(t: number, amb: number) {
  let zoom = 1 + Math.sin(amb * 0.13) * 0.012;
  let roll = Math.sin(amb * 0.17) * 0.006;
  let x = Math.sin(amb * 0.31) * 14;
  let y = Math.cos(amb * 0.23) * 10;
  // Act I glide in
  zoom *= lerp(0.9, 1, easeOut(prog(t, 0, 3)));
  // Push-through dive into the logo's centre facet
  const dive = easeIn(prog(t, 26.3, 28.5));
  if (t < 28.5) {
    zoom *= lerp(1, 18, dive);
    roll += lerp(0, -0.14, dive);
    y += lerp(0, 75, dive);
    x *= 1 - dive;
  }
  return { zoom, roll, x, y };
}

export function drawFrame(ctx: CanvasRenderingContext2D, t: number, amb: number, A: FilmAssets, fonts: FilmFonts, o: FrameOptions) {
  F = fonts;
  const c = ctx as Ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  background(c, t, amb);
  grid(c, t, amb);
  particles(c, t, amb);

  const cam = camera(t, amb);
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(cam.zoom, cam.zoom);
  c.rotate(cam.roll);
  c.translate(cam.x, cam.y);
  sceneGenesis(c, t, amb);
  sceneStudio(c, t, amb, A);
  sceneEngine(c, t, amb);
  sceneReplay(c, t, amb);
  sceneOrbit(c, t, amb);
  sceneFinale(c, t, amb);
  c.restore();

  lightSweep(c, amb);
  flash(c, t);
  vignette(c);
  hud(c, t, amb);
  if (o.captions) captions(c, t);
}
