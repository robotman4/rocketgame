// Core helpers: view size, math, easing, tweens, seeded random.

// Logical coordinate system: height is always 768, width follows the screen aspect.
export const V = { w: 1024, h: 768, scale: 1, dpr: 1, ui: 1, safeL: 0, safeR: 0, safeT: 0, safeB: 0 };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const TAU = Math.PI * 2;

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

// Small tween runner. Each scene owns one.
export class Tweens {
  constructor() { this.list = []; }
  add(obj, props, dur, opts = {}) {
    const tw = { obj, props, dur, t: -(opts.delay || 0), ease: opts.ease || ease.outQuad, onDone: opts.onDone, from: null, arc: opts.arc || 0 };
    this.list.push(tw);
    return tw;
  }
  cancel(obj) { this.list = this.list.filter((tw) => tw.obj !== obj); }
  update(dt) {
    const done = [];
    for (const tw of this.list) {
      tw.t += dt;
      if (tw.t < 0) continue;
      if (!tw.from) {
        tw.from = {};
        for (const k in tw.props) tw.from[k] = tw.obj[k];
      }
      const p = clamp(tw.t / tw.dur, 0, 1);
      const e = tw.ease(p);
      for (const k in tw.props) tw.obj[k] = lerp(tw.from[k], tw.props[k], e);
      // Optional arc: lift y in a parabola while moving.
      if (tw.arc && 'y' in tw.props) tw.obj.y -= Math.sin(p * Math.PI) * tw.arc;
      if (p >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((tw) => !done.includes(tw));
      for (const tw of done) tw.onDone && tw.onDone();
    }
  }
}

// Deterministic RNG (mulberry32) so a planet looks the same every visit.
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
export const R = rng((Math.random() * 1e9) | 0);

// Color helpers (hex in, hex out).
function hexToRgb(h) {
  const m = h.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (m) return [+m[1], +m[2], +m[3]];
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => clamp(Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  return toHex(f(r), f(g), f(b));
}
export function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return toHex(Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t)));
}
