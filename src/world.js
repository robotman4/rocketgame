// Planet themes, terrain and background drawing.
import { V, TAU, rng, mix, shade, clamp } from './core.js';
import { INK, circle, ellipse, fs, rr, starPath } from './draw.js';

// Index 0 is Earth (start). 1..10 are planets; levels 11..20 revisit them at night.
export const THEMES = [
  { sky: ['#5fbfff', '#c9f0ff'], ground: '#a8662f', top: '#5cc04a', hills: ['#8fd88a', '#4fb35a'], bush: '#3fa34d', rock: '#a59fb3', decor: ['tree', 'flower', 'pipe', 'tree', 'flower'], feature: 'sun', planet: ['#4f9ee8', '#5cc04a'] },
  { sky: ['#ff8fcf', '#ffe0f2'], ground: '#7b45b0', top: '#c78bff', hills: ['#e6a6ff', '#b56be0'], bush: '#9b4fd0', rock: '#b9a6d0', decor: ['mushroom', 'mushroom', 'flower'], feature: 'rings', planet: ['#c78bff', '#ff8fcf'] },
  { sky: ['#ffa94d', '#ffe9b0'], ground: '#c97a30', top: '#f3c25e', hills: ['#ffd38a', '#e8a24f'], bush: '#6aa84f', rock: '#d6a46e', decor: ['cactus', 'cactus', 'moonRock'], feature: 'sun2', planet: ['#f3c25e', '#e8a24f'] },
  { sky: ['#8edcff', '#effcff'], ground: '#6aa6d6', top: '#ffffff', hills: ['#e2f6ff', '#bfe6fa'], bush: '#9fd6f0', rock: '#c2d4e6', decor: ['iceSpike', 'snowman', 'iceSpike'], feature: 'moons', planet: ['#e2f6ff', '#6aa6d6'] },
  { sky: ['#2f2470', '#7b5cd6'], ground: '#43357f', top: '#a98bff', hills: ['#5a49b0', '#6b54c9'], bush: '#4fd0c4', rock: '#8a7bc4', decor: ['crystal', 'crystal', 'moonRock'], feature: 'rings', stars: true, planet: ['#7b5cd6', '#a98bff'] },
  { sky: ['#3d1717', '#ff7b42'], ground: '#3b2a2a', top: '#ff5a2a', hills: ['#7a3030', '#5a2626'], bush: '#8a4a2a', rock: '#5c4a4a', decor: ['lavaRock', 'volcano', 'lavaRock'], feature: 'sun2', planet: ['#ff5a2a', '#3b2a2a'] },
  { sky: ['#ffc9f0', '#fff4fb'], ground: '#f28cb1', top: '#fff0a8', hills: ['#ffd6ea', '#ffb3d1'], bush: '#7fe0b0', rock: '#e7b8d4', decor: ['lollipop', 'candyCane', 'lollipop'], feature: 'sun', planet: ['#f28cb1', '#fff0a8'] },
  { sky: ['#2fc6c0', '#b8fff4'], ground: '#e0c27a', top: '#ffeaa6', hills: ['#5fd8c8', '#2fb8a8'], bush: '#2f9e7a', rock: '#c2b08a', decor: ['coral', 'seaweed', 'coral'], feature: 'moons', planet: ['#2fc6c0', '#ffeaa6'] },
  { sky: ['#14143a', '#3d3d6b'], ground: '#8a8a9a', top: '#c9c9d6', hills: ['#5c5c74', '#74748c'], bush: '#9a9ab0', rock: '#a0a0b4', decor: ['crater', 'moonRock', 'crater'], feature: 'earth', stars: true, planet: ['#c9c9d6', '#8a8a9a'] },
  { sky: ['#7ed46a', '#e2ffd2'], ground: '#6b4a2a', top: '#2f9e44', hills: ['#5cbf5a', '#3d8a3a'], bush: '#2f8a3a', rock: '#8a8a7a', decor: ['palm', 'tree', 'flower', 'pipe'], feature: 'sun', planet: ['#2f9e44', '#7ed46a'] },
  { sky: ['#9cc2ff', '#ffffff'], ground: '#d8e4ff', top: '#ffe36e', hills: ['#ffffff', '#e6eeff'], bush: '#ffb3d1', rock: '#c8d0e8', decor: ['rainbow', 'cloudPuff', 'cloudPuff'], feature: 'sun', planet: ['#ffe36e', '#9cc2ff'] },
];

export function themeFor(level) {
  if (level === 0) return { ...THEMES[0], night: false, idx: 0 };
  const idx = ((level - 1) % 10) + 1;
  const base = THEMES[idx];
  if (level <= 10) return { ...base, night: false, idx };
  if (level > 20) {
    // Danger zone: same places, but under a red, stormy sky.
    return {
      ...base, idx, night: true, stars: true, danger: true,
      sky: [mix(base.sky[0], '#2a0610', 0.72), mix(base.sky[1], '#8a1c24', 0.55)],
      hills: [mix(base.hills[0], '#5a1020', 0.5), mix(base.hills[1], '#3a0a18', 0.5)],
      planet: [mix(base.planet[0], '#c0392b', 0.55), mix(base.planet[1], '#5a0a14', 0.5)],
    };
  }
  return {
    ...base, idx, night: true, stars: true,
    sky: [mix(base.sky[0], '#0b0b3a', 0.62), mix(base.sky[1], '#3a2a6a', 0.45)],
    hills: [shade(base.hills[0], -0.35), shade(base.hills[1], -0.3)],
  };
}

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const GROUND_BASE = 640;

export class World {
  constructor(level) {
    this.level = level;
    this.theme = themeFor(level);
    this.seed = 1000 + level * 7919;
    const r = rng(this.seed);
    this.rocketX = Math.round(V.w / 2);
    this.width = level === 0 ? V.w : Math.round(Math.max(V.w * 1.8, V.w * (1.6 + Math.min(level, 22) * 0.12)));
    this.amp = level === 0 ? 8 : 16 + Math.min(level, 12) * 2.5;
    this.p1 = r() * TAU; this.p2 = r() * TAU;
    this.decor = [];
    let x = -500;
    while (x < this.width + 600) {
      x += r.range(150, 280);
      if (Math.abs(x - this.rocketX) < 190) continue;
      const type = r.pick(this.theme.decor);
      this.decor.push({ x, type, s: r.range(0.75, 1.15), seed: r(), back: true });
    }
  }

  groundAt(x) {
    const h = this.amp * Math.sin(x * 0.0062 + this.p1) + this.amp * 0.45 * Math.sin(x * 0.0141 + this.p2);
    const f = smooth(230, 420, Math.abs(x - this.rocketX));
    return GROUND_BASE + h * f;
  }

  // spaceMix: 0 = planet sky, 1 = deep space (used during flight).
  drawSky(ctx, camX, camY, t, spaceMix = 0) {
    const th = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, mix(th.sky[0], '#05051a', spaceMix));
    g.addColorStop(1, mix(th.sky[1], '#1a1446', spaceMix));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, V.w, V.h);
    const starA = Math.max(th.stars ? 1 : 0, spaceMix);
    if (starA > 0) drawStars(ctx, camX * 0.05, camY * 0.05, t, starA);
    // Sky feature (sun, rings, moons), fades out in space.
    const fx = V.w * 0.8 - camX * 0.04, fy = 130 - camY * 0.04;
    ctx.globalAlpha = 1 - spaceMix;
    if (th.night && (th.feature === 'sun' || th.feature === 'sun2')) {
      // Crescent moon at night.
      const mg = ctx.createRadialGradient(fx, fy, 20, fx, fy, 110);
      mg.addColorStop(0, 'rgba(255,250,210,0.35)'); mg.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = mg; circle(ctx, fx, fy, 110); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy, 46, 0.6, Math.PI * 2 - 0.6); ctx.arc(fx + 22, fy - 6, 36, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath();
      fs(ctx, '#fff6c0');
    } else if (th.feature === 'sun' || th.feature === 'sun2') {
      const c = th.feature === 'sun' ? '#ffe14d' : '#ffb347';
      const sg = ctx.createRadialGradient(fx, fy, 30, fx, fy, 130);
      sg.addColorStop(0, 'rgba(255,240,150,0.7)'); sg.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = sg; circle(ctx, fx, fy, 130); ctx.fill();
      circle(ctx, fx, fy, 52); fs(ctx, c);
      if (!th.night) {
        ctx.fillStyle = INK;
        ellipse(ctx, fx - 16, fy - 6, 5, 8); ctx.fill(); ellipse(ctx, fx + 16, fy - 6, 5, 8); ctx.fill();
        ctx.beginPath(); ctx.arc(fx, fy + 6, 18, 0.2, Math.PI - 0.2); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      }
    } else if (th.feature === 'rings') {
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(-0.3);
      circle(ctx, 0, 0, 60); fs(ctx, shade(th.top, 0.2));
      ctx.beginPath(); ctx.ellipse(0, 0, 105, 22, 0, 0.05, Math.PI - 0.05); ctx.lineWidth = 10; ctx.strokeStyle = shade(th.hills[0], 0.3); ctx.stroke();
      ctx.restore();
    } else if (th.feature === 'moons') {
      circle(ctx, fx, fy, 40); fs(ctx, '#f5f0e0');
      circle(ctx, fx - 12, fy - 8, 8); ctx.fillStyle = '#ddd6c0'; ctx.fill();
      circle(ctx, fx - 140, fy + 50, 22); fs(ctx, '#ffd0a0');
    } else if (th.feature === 'earth') {
      circle(ctx, fx, fy, 55); fs(ctx, '#3b8fe8');
      ctx.save(); circle(ctx, fx, fy, 55); ctx.clip();
      ctx.fillStyle = '#5cc04a';
      ellipse(ctx, fx - 18, fy - 10, 22, 16); ctx.fill(); ellipse(ctx, fx + 22, fy + 18, 18, 12); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (spaceMix < 1) this.drawClouds(ctx, camX, camY, t, 1 - spaceMix);
  }

  drawClouds(ctx, camX, camY, t, alpha) {
    if (this.theme.idx === 8 || this.theme.idx === 4) return;
    ctx.globalAlpha = alpha * (this.theme.night ? 0.35 : 0.95);
    const span = V.w + 600;
    for (let i = 0; i < 5; i++) {
      const x = ((hash(i + this.seed) * span + t * 12 - camX * 0.1) % span + span) % span - 300;
      const y = 70 + hash(i * 3 + this.seed) * 170 - camY * 0.1;
      const s = 0.7 + hash(i * 7) * 0.6;
      cloud(ctx, x, y, s, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  drawHills(ctx, camX, camY) {
    const th = this.theme;
    for (const [f, base, sp, rmin, rmax, col, eyes] of [[0.25, 610, 340, 170, 250, th.hills[0], false], [0.5, 650, 270, 100, 150, th.hills[1], true]]) {
      const ox = camX * f, oy = -camY * f;
      const i0 = Math.floor((ox - 300) / sp), i1 = Math.ceil((ox + V.w + 300) / sp);
      for (let i = i0; i <= i1; i++) {
        const r = rmin + hash(i * 1.7 + f) * (rmax - rmin);
        const x = i * sp + hash(i * 3.3 + f) * 80 - ox;
        const y = base + oy;
        ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath();
        fs(ctx, col, 4);
        ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.55, r * 0.18, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
        if (eyes && hash(i * 5.1) > 0.5) {
          ctx.fillStyle = INK;
          ellipse(ctx, x - 14, y - r * 0.55, 5, 11); ctx.fill();
          ellipse(ctx, x + 14, y - r * 0.55, 5, 11); ctx.fill();
        }
      }
    }
  }

  drawGround(ctx, camX, camY) {
    const th = this.theme, step = 16;
    const x0 = Math.floor((camX - 40) / step) * step, x1 = camX + V.w + 40;
    const pts = [];
    for (let x = x0; x <= x1; x += step) pts.push([x - camX, this.groundAt(x) - camY]);
    const bottom = Math.max(V.h, ...pts.map((p) => p[1])) + 20;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    ctx.fillStyle = th.ground; ctx.fill();
    // dirt texture
    ctx.fillStyle = shade(th.ground, -0.18);
    const c0 = Math.floor(camX / 70) - 1, c1 = Math.ceil((camX + V.w) / 70) + 1;
    for (let c = c0; c <= c1; c++) {
      const gx = c * 70 + hash(c) * 40;
      const gy = this.groundAt(gx) + 45 + hash(c * 2.1) * 70;
      rr(ctx, gx - camX, gy - camY, 18 + hash(c * 4) * 14, 10, 5); ctx.fill();
    }
    // top layer
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + 9) : ctx.moveTo(p[0], p[1] + 9)));
    ctx.lineWidth = 22; ctx.strokeStyle = th.top; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + 20) : ctx.moveTo(p[0], p[1] + 20)));
    ctx.lineWidth = 4; ctx.strokeStyle = shade(th.top, -0.3); ctx.stroke();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 2) : ctx.moveTo(p[0], p[1] - 2)));
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  }

  drawDecor(ctx, camX, camY, t) {
    for (const d of this.decor) {
      const sx = d.x - camX;
      if (sx < -250 || sx > V.w + 250) continue;
      drawDecor(ctx, d.type, sx, this.groundAt(d.x) - camY + 4, d.s, d.seed, t, this.theme);
    }
  }

  drawBackground(ctx, camX, camY, t, spaceMix = 0) {
    this.drawSky(ctx, camX, camY, t, spaceMix);
    this.drawHills(ctx, camX, camY);
    this.drawDecor(ctx, camX, camY, t);
    this.drawGround(ctx, camX, camY);
  }
}

export function drawStars(ctx, ox, oy, t, alpha) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i) * V.w * 1.2 - ox) % V.w + V.w) % V.w;
    const y = ((hash(i + 500) * V.h - oy) % V.h + V.h) % V.h;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    ctx.globalAlpha = alpha * (0.4 + tw * 0.6);
    const s = 1 + hash(i + 900) * 2.5;
    if (s > 3) { starPath(ctx, x, y, s * 1.6, s * 0.5, 4, 0); ctx.fill(); } else { ctx.fillRect(x, y, s, s); }
  }
  ctx.globalAlpha = 1;
}

export function cloud(ctx, x, y, s, c) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(-40, 10, 28, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(-10, -12, 34, Math.PI, Math.PI * 1.85);
  ctx.arc(30, -4, 28, Math.PI * 1.3, Math.PI * 0.2);
  ctx.arc(40, 18, 20, Math.PI * 1.6, Math.PI * 0.5);
  ctx.closePath();
  fs(ctx, c, 4);
  ctx.restore();
}

// Decorative props. Origin at ground level.
export function drawDecor(ctx, type, x, y, s, seed, t, th) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const accent = ['#ff5e7e', '#ffe14d', '#7ab8ff', '#ffffff', '#c78bff'][Math.floor(seed * 5)];
  switch (type) {
    case 'tree':
      rr(ctx, -10, -70, 20, 72, 6); fs(ctx, '#8a5a30');
      circle(ctx, -26, -88, 32); fs(ctx, th.hills[1]);
      circle(ctx, 26, -88, 32); fs(ctx, th.hills[1]);
      circle(ctx, 0, -118, 38); fs(ctx, th.hills[1]);
      circle(ctx, -10, -128, 10); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      break;
    case 'flower':
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -20, 0, -40); ctx.lineWidth = 5; ctx.strokeStyle = '#2f8a3a'; ctx.stroke();
      for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 + t * 0.5; circle(ctx, Math.cos(a) * 11, -46 + Math.sin(a) * 11, 9); fs(ctx, accent, 3); }
      circle(ctx, 0, -46, 7); fs(ctx, '#ffcc1a', 3);
      break;
    case 'pipe':
      rr(ctx, -30, -80, 60, 84, 4); fs(ctx, '#3cc04a');
      rr(ctx, -38, -100, 76, 26, 6); fs(ctx, '#4fd85c');
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-22, -74, 8, 70); ctx.fillRect(-28, -96, 8, 18);
      break;
    case 'mushroom':
      rr(ctx, -12, -50, 24, 52, 10); fs(ctx, '#fff4e0');
      ctx.beginPath(); ctx.moveTo(-50, -44); ctx.quadraticCurveTo(-48, -100, 0, -102); ctx.quadraticCurveTo(48, -100, 50, -44); ctx.closePath();
      fs(ctx, seed > 0.5 ? '#ff4f6a' : '#4fb0ff');
      ctx.fillStyle = '#ffffff';
      circle(ctx, -22, -70, 9); ctx.fill(); circle(ctx, 14, -82, 11); ctx.fill(); circle(ctx, 30, -58, 6); ctx.fill();
      ctx.fillStyle = INK; ellipse(ctx, -5, -30, 3, 5); ctx.fill(); ellipse(ctx, 5, -30, 3, 5); ctx.fill();
      break;
    case 'cactus':
      rr(ctx, -14, -100, 28, 102, 14); fs(ctx, '#4fb35a');
      rr(ctx, -42, -78, 16, 40, 8); fs(ctx, '#4fb35a');
      rr(ctx, -40, -46, 30, 14, 7); fs(ctx, '#4fb35a');
      rr(ctx, 26, -88, 16, 34, 8); fs(ctx, '#4fb35a');
      rr(ctx, 12, -62, 28, 14, 7); fs(ctx, '#4fb35a');
      circle(ctx, 0, -104, 7); fs(ctx, '#ff7ab8', 3);
      break;
    case 'iceSpike':
      [[-24, 70, 22], [0, 110, 28], [24, 80, 22]].forEach(([ox, h, w]) => {
        ctx.beginPath(); ctx.moveTo(ox - w, 2); ctx.lineTo(ox, -h); ctx.lineTo(ox + w, 2); ctx.closePath(); fs(ctx, '#d6f4ff');
        ctx.beginPath(); ctx.moveTo(ox - w * 0.3, 0); ctx.lineTo(ox, -h * 0.8); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      });
      break;
    case 'snowman':
      circle(ctx, 0, -30, 32); fs(ctx, '#ffffff');
      circle(ctx, 0, -82, 24); fs(ctx, '#ffffff');
      ctx.fillStyle = INK; circle(ctx, -8, -88, 3.5); ctx.fill(); circle(ctx, 8, -88, 3.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(20, -76); ctx.lineTo(0, -74); ctx.fillStyle = '#ff8a1a'; ctx.fill();
      rr(ctx, -20, -112, 40, 10, 3); fs(ctx, '#e8443a', 3);
      break;
    case 'crystal':
      [[-20, 70, -0.25, '#4fe0ff'], [16, 54, 0.3, '#ff7be0'], [0, 100, 0, '#b48bff']].forEach(([ox, h, r, c]) => {
        ctx.save(); ctx.translate(ox, 0); ctx.rotate(r);
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -h + 18); ctx.lineTo(0, -h); ctx.lineTo(14, -h + 18); ctx.lineTo(14, 0); ctx.closePath();
        fs(ctx, c);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-8, -h + 22, 5, h - 28);
        ctx.restore();
      });
      break;
    case 'lavaRock':
      ctx.beginPath(); ctx.moveTo(-50, 2); ctx.quadraticCurveTo(-46, -50, -6, -56); ctx.quadraticCurveTo(44, -54, 48, 2); ctx.closePath();
      fs(ctx, '#4a3434');
      ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-4, -24); ctx.lineTo(-12, -6); ctx.moveTo(10, -46); ctx.lineTo(22, -26);
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,${120 + Math.sin(t * 3 + seed * 9) * 60},40,1)`; ctx.stroke();
      break;
    case 'volcano':
      ctx.beginPath(); ctx.moveTo(-110, 2); ctx.lineTo(-30, -130); ctx.lineTo(30, -130); ctx.lineTo(110, 2); ctx.closePath(); fs(ctx, '#5a2a2a');
      ctx.beginPath(); ctx.moveTo(-30, -130); ctx.lineTo(30, -130); ctx.lineTo(18, -100); ctx.lineTo(4, -112); ctx.lineTo(-10, -92); ctx.lineTo(-22, -110); ctx.closePath(); fs(ctx, '#ff6a1a', 3);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.4 + i / 3 + seed) % 1;
        ctx.globalAlpha = 1 - k; circle(ctx, Math.sin(k * 6 + i) * 14, -150 - k * 120, 14 + k * 24); fs(ctx, '#8a7a7a', 3); ctx.globalAlpha = 1;
      }
      break;
    case 'lollipop':
      rr(ctx, -4, -90, 8, 92, 3); fs(ctx, '#ffffff', 3);
      circle(ctx, 0, -110, 32); fs(ctx, accent === '#ffffff' ? '#ff7ab8' : accent);
      ctx.beginPath();
      for (let a = 0; a < 14; a += 0.2) ctx.lineTo(Math.cos(a + t) * a * 2, -110 + Math.sin(a + t) * a * 2);
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      break;
    case 'candyCane':
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -90); ctx.arc(-22, -90, 22, 0, Math.PI, true);
      ctx.lineWidth = 22; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 15; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.setLineDash([10, 10]); ctx.strokeStyle = '#ff3d5e'; ctx.stroke(); ctx.setLineDash([]);
      break;
    case 'coral':
      ctx.lineCap = 'round';
      [[0, 0, 0, -90], [0, -40, -30, -80], [0, -55, 28, -100], [-30, -80, -40, -105]].forEach(([a, b, c, d]) => {
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d);
        ctx.lineWidth = 20; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 13; ctx.strokeStyle = seed > 0.5 ? '#ff7a8a' : '#ffa64d'; ctx.stroke();
      });
      break;
    case 'seaweed':
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(k * 16, 0);
        for (let i = 1; i <= 8; i++) ctx.lineTo(k * 16 + Math.sin(t * 2 + i * 0.8 + k) * 8, -i * 14);
        ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
        ctx.lineWidth = 8; ctx.strokeStyle = '#2fbf6a'; ctx.stroke();
      }
      break;
    case 'crater':
      ellipse(ctx, 0, 0, 60, 14); fs(ctx, shade(th.top, -0.25), 4);
      ellipse(ctx, 0, 3, 46, 9); ctx.fillStyle = shade(th.top, -0.4); ctx.fill();
      break;
    case 'moonRock':
      ctx.beginPath(); ctx.moveTo(-36, 2); ctx.quadraticCurveTo(-36, -40, 0, -42); ctx.quadraticCurveTo(36, -40, 36, 2); ctx.closePath();
      fs(ctx, th.rock);
      ctx.fillStyle = shade(th.rock, -0.2); circle(ctx, -10, -24, 6); ctx.fill(); circle(ctx, 12, -14, 4); ctx.fill();
      break;
    case 'palm':
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(-4, -80, 18, -150); ctx.lineTo(30, -148); ctx.quadraticCurveTo(10, -80, 10, 2); ctx.closePath();
      fs(ctx, '#a0703a');
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.6 + Math.sin(t + i) * 0.05;
        ctx.save(); ctx.translate(24, -150); ctx.rotate(a);
        ellipse(ctx, 40, 0, 44, 13); fs(ctx, '#2fae4a');
        ctx.restore();
      }
      circle(ctx, 18, -138, 9); fs(ctx, '#7a4a20', 3); circle(ctx, 32, -136, 9); fs(ctx, '#7a4a20', 3);
      break;
    case 'rainbow':
      ['#ff5e5e', '#ffb34d', '#ffe14d', '#5cd65c', '#4fa8ff', '#a678ff'].forEach((c, i) => {
        ctx.beginPath(); ctx.arc(0, 0, 110 - i * 12, Math.PI, 0); ctx.lineWidth = 12; ctx.strokeStyle = c; ctx.stroke();
      });
      cloud(ctx, -100, -6, 0.7, '#ffffff'); cloud(ctx, 100, -6, 0.7, '#ffffff');
      break;
    case 'cloudPuff':
      cloud(ctx, 0, -26, 0.8, '#ffffff');
      break;
  }
  ctx.restore();
}
