// Rocket parts. Coordinates are local to the rocket: (0,0) is the bottom centre, up is negative y.
import { INK, rr, circle, fs, tubeShade, starPath } from './draw.js';
import { shade, TAU } from './core.js';
import { save } from './storage.js';

export const DRAW_ORDER = ['fins', 'engine', 'body', 'window', 'nose'];
export const SLOT_BOX = {
  engine: { x: -50, y: -54, w: 100, h: 54 },
  body: { x: -72, y: -252, w: 144, h: 204 },
  window: { x: -36, y: -214, w: 72, h: 76 },
  fins: { x: -118, y: -152, w: 236, h: 116 },
  nose: { x: -62, y: -352, w: 124, h: 104 },
};
export const VARIANTS = { engine: 3, body: 4, window: 3, fins: 3, nose: 4 };
export const COLORS = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5', '#f06fb0', '#f2f2f2', '#2ec4b6'];
export const ROCKET_TOP = -352;
export const HATCH = { x: 0, y: -95 };

export function slotCenter(slot) {
  const b = SLOT_BOX[slot];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

const METAL = '#a7b0c2';

function bodyPath(ctx, v) {
  ctx.beginPath();
  if (v === 1) {
    ctx.moveTo(-56, -50);
    ctx.bezierCurveTo(-82, -100, -82, -200, -56, -250);
    ctx.lineTo(56, -250);
    ctx.bezierCurveTo(82, -200, 82, -100, 56, -50);
    ctx.closePath();
  } else {
    rr(ctx, -60, -250, 120, 200, 16);
  }
}

function drawBody(ctx, v, c) {
  bodyPath(ctx, v);
  fs(ctx, c);
  ctx.save();
  bodyPath(ctx, v);
  ctx.clip();
  if (v === 0) {
    ctx.fillStyle = METAL;
    ctx.fillRect(-90, -82, 180, 12); ctx.fillRect(-90, -238, 180, 12);
    ctx.fillStyle = INK;
    for (let i = -48; i <= 48; i += 16) { circle(ctx, i, -76, 2.2); ctx.fill(); circle(ctx, i, -232, 2.2); ctx.fill(); }
  } else if (v === 1) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-90, -120, 180, 10); ctx.fillRect(-90, -232, 180, 10);
  } else if (v === 2) {
    ctx.fillStyle = shade(c, c === '#f2f2f2' ? -0.5 : 0.45);
    for (let i = -3; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-80, -40 - i * 60); ctx.lineTo(80, -110 - i * 60); ctx.lineTo(80, -85 - i * 60); ctx.lineTo(-80, -15 - i * 60);
      ctx.fill();
    }
  } else if (v === 3) {
    // Junkyard patches with bolts, like a Mulle Meck build.
    ctx.save(); ctx.translate(-30, -100); ctx.rotate(-0.15);
    rr(ctx, -20, -18, 40, 36, 3); fs(ctx, shade(c, -0.25), 3);
    ctx.fillStyle = INK; [[-14, -12], [14, -12], [-14, 12], [14, 12]].forEach(([a, b]) => { circle(ctx, a, b, 2.4); ctx.fill(); });
    ctx.restore();
    ctx.save(); ctx.translate(34, -225); ctx.rotate(0.2);
    rr(ctx, -18, -14, 36, 28, 3); fs(ctx, METAL, 3);
    ctx.fillStyle = INK; [[-12, -8], [12, -8], [-12, 8], [12, 8]].forEach(([a, b]) => { circle(ctx, a, b, 2.4); ctx.fill(); });
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(30, -130); ctx.lineTo(42, -122); ctx.lineTo(36, -110);
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.restore();
  bodyPath(ctx, v);
  tubeShade(ctx, v === 1 ? -80 : -60, v === 1 ? 80 : 60);
  bodyPath(ctx, v);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
}

function nosePath(ctx, v) {
  ctx.beginPath();
  if (v === 0) {
    ctx.moveTo(-60, -248); ctx.quadraticCurveTo(-52, -315, 0, -350); ctx.quadraticCurveTo(52, -315, 60, -248);
  } else if (v === 1) {
    ctx.moveTo(-60, -248); ctx.arc(0, -248, 60, Math.PI, 0);
  } else if (v === 2) {
    ctx.moveTo(-60, -248); ctx.lineTo(-18, -300); ctx.lineTo(0, -350); ctx.lineTo(18, -300); ctx.lineTo(60, -248);
  } else {
    ctx.moveTo(-60, -248); ctx.bezierCurveTo(-64, -340, 64, -340, 60, -248);
  }
  ctx.closePath();
}

function drawNose(ctx, v, c) {
  if (v === 1) {
    ctx.beginPath(); ctx.moveTo(0, -306); ctx.lineTo(0, -338); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, 0, -342, 9); fs(ctx, '#ff3d5e');
  }
  nosePath(ctx, v);
  fs(ctx, c);
  ctx.save();
  nosePath(ctx, v); ctx.clip();
  if (v === 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-70, -290, 140, 12); }
  if (v === 3) { ctx.fillStyle = shade(c, -0.3); ctx.fillRect(-70, -275, 140, 10); }
  if (v === 0) { starPath(ctx, 0, -290, 12, 5); ctx.fillStyle = '#ffe14d'; ctx.fill(); }
  ctx.restore();
  nosePath(ctx, v); tubeShade(ctx, -60, 60);
  nosePath(ctx, v); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, -62, -256, 124, 12, 5); fs(ctx, METAL, 3);
}

function drawEngine(ctx, v, c) {
  if (v === 0) {
    ctx.beginPath(); ctx.moveTo(-30, -52); ctx.lineTo(30, -52); ctx.lineTo(48, -2); ctx.lineTo(-48, -2); ctx.closePath();
    fs(ctx, METAL);
    ctx.beginPath(); ctx.moveTo(-30, -52); ctx.lineTo(30, -52); ctx.lineTo(48, -2); ctx.lineTo(-48, -2); ctx.closePath();
    tubeShade(ctx, -48, 48);
    rr(ctx, -36, -38, 72, 12, 4); fs(ctx, c, 3);
    ctx.beginPath(); ctx.ellipse(0, -2, 48, 7, 0, 0, TAU); fs(ctx, '#3a3350', 3);
  } else if (v === 1) {
    rr(ctx, -46, -54, 92, 16, 5); fs(ctx, c);
    for (const sx of [-24, 24]) {
      ctx.beginPath(); ctx.moveTo(sx - 13, -40); ctx.lineTo(sx + 13, -40); ctx.lineTo(sx + 22, -2); ctx.lineTo(sx - 22, -2); ctx.closePath();
      fs(ctx, METAL);
      ctx.beginPath(); ctx.ellipse(sx, -2, 22, 5, 0, 0, TAU); fs(ctx, '#3a3350', 3);
    }
  } else {
    rr(ctx, -46, -54, 92, 40, 12); fs(ctx, c);
    rr(ctx, -46, -54, 92, 40, 12); tubeShade(ctx, -46, 46);
    rr(ctx, -46, -54, 92, 40, 12); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK;
    for (let i = -28; i <= 28; i += 14) ctx.fillRect(i - 2, -46, 4, 22);
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(18, -14); ctx.lineTo(26, -2); ctx.lineTo(-26, -2); ctx.closePath();
    fs(ctx, METAL, 3);
  }
}

function drawWindow(ctx, v, c, crew) {
  const glass = (x, y, r) => {
    circle(ctx, x, y, r);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, '#d8f6ff'); g.addColorStop(1, '#4aa8e0');
    fs(ctx, g, 3);
    if (crew) {
      ctx.save(); circle(ctx, x, y, r); ctx.clip();
      const hx = save.buddy ? x - r * 0.25 : x;
      circle(ctx, hx, y + r * 0.5, r * 0.75); fs(ctx, '#ffffff', 2);
      ctx.fillStyle = '#2b3a67'; rr(ctx, hx - r * 0.45, y + r * 0.2, r * 0.9, r * 0.5, 5); ctx.fill();
      if (save.buddy) {
        // The alien buddy peeks out next to the astronaut.
        circle(ctx, x + r * 0.5, y + r * 0.55, r * 0.42); fs(ctx, '#7bd36b', 2);
        circle(ctx, x + r * 0.5, y + r * 0.45, r * 0.18); fs(ctx, '#ffffff', 1.5);
        circle(ctx, x + r * 0.53, y + r * 0.46, r * 0.08); ctx.fillStyle = INK; ctx.fill();
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(x, y, r * 0.65, Math.PI * 1.1, Math.PI * 1.5);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  };
  if (v === 0) {
    circle(ctx, 0, -176, 34); fs(ctx, METAL);
    ctx.fillStyle = INK;
    for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; circle(ctx, Math.cos(a) * 29, -176 + Math.sin(a) * 29, 2.2); ctx.fill(); }
    glass(0, -176, 24);
  } else if (v === 1) {
    for (const y of [-196, -154]) { circle(ctx, 0, y, 20); fs(ctx, c); glass(0, y, 13); }
  } else {
    rr(ctx, -32, -208, 64, 64, 14); fs(ctx, c);
    rr(ctx, -22, -198, 44, 44, 9);
    const g = ctx.createLinearGradient(-22, -198, 22, -154);
    g.addColorStop(0, '#d8f6ff'); g.addColorStop(1, '#4aa8e0');
    fs(ctx, g, 3);
    ctx.beginPath(); ctx.moveTo(0, -198); ctx.lineTo(0, -154); ctx.moveTo(-22, -176); ctx.lineTo(22, -176);
    ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.stroke();
  }
}

function finPath(ctx, v) {
  ctx.beginPath();
  if (v === 0) {
    ctx.moveTo(-55, -150); ctx.lineTo(-114, -64); ctx.lineTo(-114, -38); ctx.lineTo(-55, -56);
  } else if (v === 1) {
    ctx.moveTo(-55, -136); ctx.quadraticCurveTo(-122, -112, -116, -38); ctx.lineTo(-92, -46); ctx.quadraticCurveTo(-82, -70, -55, -58);
  } else {
    ctx.moveTo(-55, -148); ctx.bezierCurveTo(-128, -144, -128, -48, -72, -40); ctx.lineTo(-55, -56);
  }
  ctx.closePath();
}

function drawFins(ctx, v, c) {
  for (const sx of [1, -1]) {
    ctx.save();
    ctx.scale(sx, 1);
    finPath(ctx, v);
    fs(ctx, c);
    ctx.save(); finPath(ctx, v); ctx.clip();
    ctx.fillStyle = shade(c, c === '#f2f2f2' ? -0.4 : -0.25);
    ctx.fillRect(-130, -70, 80, 40);
    ctx.restore();
    finPath(ctx, v); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
}

export function drawPart(ctx, slot, part, crew) {
  if (part.finish) { drawFinished(ctx, slot, part, crew); return; }
  const { variant: v, color: c } = part;
  if (slot === 'body') drawBody(ctx, v, c);
  else if (slot === 'nose') drawNose(ctx, v, c);
  else if (slot === 'engine') drawEngine(ctx, v, c);
  else if (slot === 'window') drawWindow(ctx, v, c, crew);
  else if (slot === 'fins') drawFins(ctx, v, c);
}

// Dashed outline that shows where a part goes.
export function drawGhost(ctx, slot, glow, t) {
  ctx.save();
  ctx.beginPath();
  if (slot === 'body') rr(ctx, -60, -250, 120, 200, 16);
  else if (slot === 'nose') { ctx.moveTo(-60, -248); ctx.quadraticCurveTo(-52, -315, 0, -350); ctx.quadraticCurveTo(52, -315, 60, -248); ctx.closePath(); }
  else if (slot === 'engine') { ctx.moveTo(-30, -52); ctx.lineTo(30, -52); ctx.lineTo(48, -2); ctx.lineTo(-48, -2); ctx.closePath(); }
  else if (slot === 'window') circle(ctx, 0, -176, 30);
  else if (slot === 'fins') {
    for (const sx of [1, -1]) {
      ctx.moveTo(-55 * sx, -150); ctx.lineTo(-114 * sx, -64); ctx.lineTo(-114 * sx, -38); ctx.lineTo(-55 * sx, -56); ctx.closePath();
    }
  }
  const pulse = (Math.sin(t * 6) + 1) / 2;
  ctx.fillStyle = glow ? `rgba(255,240,120,${0.35 + pulse * 0.25})` : 'rgba(255,255,255,0.18)';
  ctx.fill();
  if (glow) {
    ctx.shadowColor = '#fff27a'; ctx.shadowBlur = 25;
  }
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -t * 30;
  ctx.lineWidth = glow ? 7 : 5;
  ctx.strokeStyle = glow ? '#fff27a' : 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.restore();
}

// cfg: { slot: {variant,color} | null }
export function drawRocket(ctx, x, y, cfg, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.scale) ctx.scale(o.scale, o.scale);
  for (const slot of DRAW_ORDER) {
    if (cfg[slot]) drawPart(ctx, slot, cfg[slot], o.crew);
    else if (o.ghost) drawGhost(ctx, slot, o.glow === slot, o.t || 0);
    if (slot === 'body' && cfg.body && o.hatch) {
      // Round hatch the astronauts climb into.
      const open = o.hatch;
      circle(ctx, HATCH.x, HATCH.y, 22); fs(ctx, METAL, 3);
      ctx.beginPath(); ctx.ellipse(HATCH.x, HATCH.y, 16, 16 * open, 0, 0, TAU); ctx.fillStyle = '#1a1430'; ctx.fill();
    }
  }
  ctx.restore();
}

// Draw a single part around its own centre (used for parts lying on the ground or being dragged).
export function drawPartAt(ctx, slot, part, x, y, s = 1, rot = 0) {
  const c = slotCenter(slot);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(-c.x, -c.y);
  drawPart(ctx, slot, part);
  ctx.restore();
}

export function randomPart(slot, rand = Math.random) {
  return { variant: Math.floor(rand() * VARIANTS[slot]), color: COLORS[Math.floor(rand() * COLORS.length)] };
}

// Striped launch pad used on Earth. y is the top of the pad.
export function drawPad(ctx, x, y) {
  rr(ctx, x - 140, y, 280, 24, 6); fs(ctx, '#7a8296');
  ctx.save();
  rr(ctx, x - 140, y, 280, 24, 6); ctx.clip();
  ctx.fillStyle = '#f7d43c';
  for (let i = -150; i < 150; i += 40) {
    ctx.beginPath(); ctx.moveTo(x + i, y + 24); ctx.lineTo(x + i + 20, y); ctx.lineTo(x + i + 34, y); ctx.lineTo(x + i + 14, y + 24); ctx.fill();
  }
  ctx.restore();
  rr(ctx, x - 140, y, 280, 24, 6); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
}

// ---------- special finishes for spare parts (gold, rainbow, galaxy) ----------
export const FINISHES = ['gold', 'rainbow', 'galaxy'];
const finishCache = new Map();
const FIN_PAD = 14, FIN_RES = 3;

// Render the part once in white, then multiply a finish over it and keep the result.
function finishedImage(slot, part, crew) {
  const key = `${slot}|${part.variant}|${part.finish}|${crew ? 1 : 0}|${save.buddy ? 1 : 0}`;
  let img = finishCache.get(key);
  if (img) return img;
  const b = SLOT_BOX[slot];
  const w = (b.w + FIN_PAD * 2) * FIN_RES, h = (b.h + FIN_PAD * 2) * FIN_RES;
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const bc = base.getContext('2d');
  bc.setTransform(FIN_RES, 0, 0, FIN_RES, (FIN_PAD - b.x) * FIN_RES, (FIN_PAD - b.y) * FIN_RES);
  drawPart(bc, slot, { variant: part.variant, color: '#f2f2f2' }, crew);
  img = document.createElement('canvas'); img.width = w; img.height = h;
  const c = img.getContext('2d');
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = 'multiply';
  let g;
  if (part.finish === 'gold') {
    g = c.createLinearGradient(0, 0, w * 0.4, h);
    ['#fff1a8', '#ffcf33', '#e69b00', '#ffe066', '#ffcf33', '#c98a00'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
  } else if (part.finish === 'rainbow') {
    g = c.createLinearGradient(0, 0, w, h * 0.3);
    const cols = ['#ff5e5e', '#ffb34d', '#ffe14d', '#5cd65c', '#4fa8ff', '#a678ff'];
    cols.forEach((col, i) => { g.addColorStop(i / cols.length, col); g.addColorStop((i + 1) / cols.length - 0.001, col); });
  } else {
    g = c.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#9b6bff'); g.addColorStop(0.5, '#4b2fa8'); g.addColorStop(1, '#1d1450');
  }
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // Keep only the part's own pixels.
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  if (part.finish === 'galaxy') {
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const hx = Math.sin(i * 91.7) * 43758.5453, hy = Math.sin(i * 12.9) * 9631.1;
      c.globalAlpha = 0.5 + (i % 3) * 0.2;
      c.beginPath(); c.arc((hx - Math.floor(hx)) * w, (hy - Math.floor(hy)) * h, (1 + (i % 3)) * FIN_RES * 0.8, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
  // Shiny diagonal streak.
  c.globalAlpha = 0.35; c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(w * 0.15, 0); c.lineTo(w * 0.32, 0); c.lineTo(w * 0.02, h); c.lineTo(-w * 0.15, h); c.closePath(); c.fill();
  c.globalAlpha = 1;
  finishCache.set(key, img);
  return img;
}

function drawFinished(ctx, slot, part, crew) {
  const b = SLOT_BOX[slot];
  ctx.drawImage(finishedImage(slot, part, crew), b.x - FIN_PAD, b.y - FIN_PAD, b.w + FIN_PAD * 2, b.h + FIN_PAD * 2);
  // Twinkles so special parts always look special.
  const t = performance.now() / 1000;
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.8 + i * 0.5) % 1;
    const sx = b.x + b.w * (0.25 + 0.5 * ((i * 0.618 + Math.floor(t * 0.8 + i * 0.5) * 0.37) % 1));
    const sy = b.y + b.h * (0.2 + 0.6 * ((i * 0.33 + Math.floor(t * 0.8 + i * 0.5) * 0.51) % 1));
    starPath(ctx, sx, sy, 10 * Math.sin(k * Math.PI), 2.5, 4, 0);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
}

// Each planet hides one spare part. Always the same one for a given planet.
export function spareFor(level) {
  const slot = DRAW_ORDER[(level * 2 + 1) % DRAW_ORDER.length];
  return { level, slot, part: { variant: (level * 7) % VARIANTS[slot], color: '#f2f2f2', finish: FINISHES[level % FINISHES.length] } };
}
