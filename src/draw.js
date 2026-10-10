// Shared drawing helpers and small sprites (astronaut, bugs, treasures, hiders, flames).
import { TAU, shade } from './core.js';
import { save } from './storage.js';

export const INK = '#2a1f3d';

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
export function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
export function fs(ctx, fill, lw = 4) {
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
export function starPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
// Glossy cylinder shading over the current path (call after the path is set).
export function tubeShade(ctx, x0, x1) {
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 5, -2000, x1 - x0 + 10, 4000);
  ctx.restore();
}

// ---------------- astronaut ----------------
// Origin at feet. Height about 100.
export function drawAstronaut(ctx, x, y, o = {}) {
  const dir = o.dir || 1, ph = o.phase || 0, color = o.color || '#f5962a';
  const walking = o.walking, s = o.scale || 1, t = o.t || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const bob = walking ? Math.abs(Math.sin(ph)) * 4 : Math.sin(t * 3) * 1.5;
  ctx.translate(0, -bob);
  const leg = walking ? Math.sin(ph) * 10 : 0;
  // backpack
  rr(ctx, -34, -66, 16, 36, 6); fs(ctx, '#b8c0d0');
  // legs
  rr(ctx, -14 + leg * 0.6, -30, 13, 30 + bob, 6); fs(ctx, '#e9edf5');
  rr(ctx, 2 - leg * 0.6, -30, 13, 30 + bob, 6); fs(ctx, '#ffffff');
  rr(ctx, -16 + leg * 0.6, -6 + bob, 17, 9, 4); fs(ctx, color);
  rr(ctx, 0 - leg * 0.6, -6 + bob, 17, 9, 4); fs(ctx, color);
  // body
  rr(ctx, -22, -66, 44, 42, 14); fs(ctx, '#ffffff');
  rr(ctx, -10, -56, 20, 14, 4); fs(ctx, color, 3);
  circle(ctx, -4, -49, 2.5); ctx.fillStyle = '#ff5050'; ctx.fill();
  circle(ctx, 4, -49, 2.5); ctx.fillStyle = '#50d050'; ctx.fill();
  // arms
  ctx.lineCap = 'round';
  const arm = (ax, ay, ex, ey) => {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey);
    ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    circle(ctx, ex, ey, 6); fs(ctx, color, 3);
  };
  if (o.arms === 'up' || o.carrying) {
    const w = o.arms === 'up' ? Math.sin(t * 12) * 5 : 0;
    arm(-18, -60, -20, -96 + w); arm(18, -60, 20, -96 - w);
  } else {
    const sw = walking ? Math.sin(ph) * 12 : Math.sin(t * 2) * 2;
    arm(-18, -60, -24 - sw * 0.3, -34 + Math.abs(sw) * 0.2);
    arm(18, -60, 24 + sw * 0.3, -34 + Math.abs(sw) * 0.2);
  }
  // helmet
  circle(ctx, 0, -88, 27); fs(ctx, '#ffffff');
  rr(ctx, -12, -100, 32, 24, 11); fs(ctx, '#2b3a67', 3);
  ctx.fillStyle = '#ffffff';
  const blink = Math.sin(t * 1.3 + x * 0.01) > 0.97;
  if (o.dizzy) {
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('x', -1, -89); ctx.fillText('x', 11, -89);
  } else if (!blink) {
    ellipse(ctx, 0, -89, 3, 4.5); ctx.fill();
    ellipse(ctx, 11, -89, 3, 4.5); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(-4, -96, 6, Math.PI * 1.1, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
  // Hat (chosen in the workshop) or the antenna.
  const hat = o.hat ?? save.hat;
  if (hat && hat !== 'none') drawHat(ctx, hat, 0, -112, 1, t);
  else {
    ctx.beginPath(); ctx.moveTo(-6, -114); ctx.lineTo(-10, -128); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, -10, -130, 5); fs(ctx, color, 3);
  }
  ctx.restore();
  if (o.dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * TAU) / 3;
      starPath(ctx, x + Math.cos(a) * 26, y - 128 * s + Math.sin(a) * 8, 8, 4);
      fs(ctx, '#ffe14d', 2);
    }
  }
}

// ---------------- bugs ----------------
export function drawBeetle(ctx, x, y, dir, t, color = '#e8443a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // legs
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const lx = -18 + i * 16, k = Math.sin(t * 14 + i * 2) * 5;
    ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx + k, 0); ctx.stroke();
  }
  ellipse(ctx, 0, -24, 32, 22); fs(ctx, color);
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -3); ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = INK;
  [[-14, -30], [-12, -16], [10, -32], [14, -18]].forEach(([a, b]) => { circle(ctx, a, b, 4.5); ctx.fill(); });
  circle(ctx, 30, -22, 15); fs(ctx, '#3a2f4d');
  // eyes with grumpy brows
  circle(ctx, 32, -27, 6); fs(ctx, '#fff', 2);
  circle(ctx, 34, -26, 2.5); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.moveTo(25, -36); ctx.lineTo(39, -32); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(36, -35); ctx.quadraticCurveTo(44, -50, 50, -46); ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

export function drawFly(ctx, x, y, dir, t, color = '#7bd36b') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const flap = Math.abs(Math.sin(t * 40));
  ctx.globalAlpha = 0.65;
  ellipse(ctx, -6, -16, 14, 22 * flap + 4, -0.4); fs(ctx, '#e8f6ff', 2);
  ellipse(ctx, 6, -16, 14, 22 * flap + 4, 0.4); fs(ctx, '#e8f6ff', 2);
  ctx.globalAlpha = 1;
  circle(ctx, 0, 0, 18); fs(ctx, color);
  ctx.save(); circle(ctx, 0, 0, 18); ctx.clip();
  ctx.fillStyle = shade(color, -0.35);
  ctx.fillRect(-20, 4, 40, 5); ctx.fillRect(-20, -6, 40, 4);
  ctx.restore();
  circle(ctx, 0, 0, 18); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  circle(ctx, 10, -6, 8); fs(ctx, '#fff', 2);
  circle(ctx, 13, -5, 3.5); ctx.fillStyle = INK; ctx.fill();
  circle(ctx, 2, -9, 6); fs(ctx, '#fff', 2);
  circle(ctx, 4, -8, 2.5); ctx.fillStyle = INK; ctx.fill();
  ctx.restore();
}

// ---------------- treasures ----------------
export const TREASURES = ['gem', 'coin', 'chest', 'crown', 'egg'];
const GEM_COLORS = ['#3ee0ff', '#ff5ec4', '#5cf27a', '#b07bff', '#ff8a3d'];

export function drawTreasure(ctx, type, x, y, t, s = 1, hue = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // soft glow
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
  g.addColorStop(0, 'rgba(255,255,200,0.55)'); g.addColorStop(1, 'rgba(255,255,200,0)');
  ctx.fillStyle = g; circle(ctx, 0, 0, 44); ctx.fill();
  if (type === 'gem') {
    const c = GEM_COLORS[hue % GEM_COLORS.length];
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(-12, -20); ctx.lineTo(12, -20); ctx.lineTo(22, -8); ctx.lineTo(0, 22); ctx.closePath();
    fs(ctx, c);
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.moveTo(-8, -8); ctx.lineTo(0, 22); ctx.lineTo(8, -8);
    ctx.lineWidth = 2; ctx.strokeStyle = shade(c, -0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-4, -16); ctx.lineTo(-8, -10); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  } else if (type === 'coin') {
    const w = Math.abs(Math.cos(t * 3));
    ellipse(ctx, 0, 0, 22 * Math.max(0.25, w), 22); fs(ctx, '#ffcc1a');
    ellipse(ctx, 0, 0, 15 * Math.max(0.25, w), 15); ctx.lineWidth = 2; ctx.strokeStyle = '#c98a00'; ctx.stroke();
    if (w > 0.5) { starPath(ctx, 0, 0, 9 * w, 4 * w); ctx.fillStyle = '#fff3a0'; ctx.fill(); }
  } else if (type === 'chest') {
    rr(ctx, -24, -8, 48, 28, 4); fs(ctx, '#a0602d');
    ctx.beginPath(); ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, -30, 24, -6); ctx.closePath(); fs(ctx, '#c47a3a');
    ctx.fillStyle = '#ffcc1a';
    ctx.fillRect(-26, -9, 52, 6); ctx.strokeRect(-26, -9, 52, 6);
    rr(ctx, -6, -6, 12, 14, 3); fs(ctx, '#ffcc1a', 2);
    circle(ctx, -14, -14, 4); ctx.fillStyle = '#3ee0ff'; ctx.fill();
    circle(ctx, 12, -15, 4); ctx.fillStyle = '#ff5ec4'; ctx.fill();
  } else if (type === 'crown') {
    ctx.beginPath(); ctx.moveTo(-24, 14); ctx.lineTo(-26, -14); ctx.lineTo(-12, 0); ctx.lineTo(0, -20); ctx.lineTo(12, 0); ctx.lineTo(26, -14); ctx.lineTo(24, 14); ctx.closePath();
    fs(ctx, '#ffcc1a');
    circle(ctx, 0, 6, 5); fs(ctx, '#ff3d5e', 2);
    circle(ctx, -14, 7, 3.5); fs(ctx, '#3ee0ff', 2);
    circle(ctx, 14, 7, 3.5); fs(ctx, '#5cf27a', 2);
  } else if (type === 'egg') {
    ellipse(ctx, 0, 0, 18, 23); fs(ctx, '#ffd84d');
    ctx.save(); ellipse(ctx, 0, 0, 18, 23); ctx.clip();
    ctx.fillStyle = '#ff7ab8'; ctx.fillRect(-20, -6, 40, 6);
    ctx.fillStyle = '#4dc3ff'; ctx.fillRect(-20, 6, 40, 5);
    ctx.restore();
    ellipse(ctx, 0, 0, 18, 23); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  }
  // twinkle
  const tw = (Math.sin(t * 4 + x * 0.1) + 1) / 2;
  starPath(ctx, 16, -18, 7 * tw + 2, 2, 4, 0); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}

// ---------------- hiders (rock, bush, ?-block) ----------------
export function drawHider(ctx, h, t, theme) {
  const { x, y } = h;
  ctx.save();
  ctx.translate(x + (h.shake ? Math.sin(t * 60) * 5 * h.shake : 0), y);
  ctx.rotate(h.rot || 0);
  if (h.type === 'rock') {
    ctx.beginPath();
    ctx.moveTo(-58, 0); ctx.quadraticCurveTo(-66, -50, -30, -66); ctx.quadraticCurveTo(10, -84, 42, -60);
    ctx.quadraticCurveTo(68, -40, 58, 0); ctx.closePath();
    fs(ctx, theme.rock || '#9a94a8');
    ctx.beginPath(); ctx.moveTo(-10, -60); ctx.lineTo(0, -40); ctx.lineTo(-8, -26); ctx.lineWidth = 3; ctx.stroke();
    ellipse(ctx, -28, -48, 12, 7, -0.4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  } else if (h.type === 'bush') {
    const c = theme.bush || '#3fa34d';
    [[-40, -26, 30], [40, -26, 30], [-18, -50, 34], [20, -52, 32], [0, -28, 36]].forEach(([a, b, r]) => { circle(ctx, a, b, r); fs(ctx, c); });
    [[-40, -26, 30], [40, -26, 30], [-18, -50, 34], [20, -52, 32], [0, -28, 36]].forEach(([a, b, r]) => { circle(ctx, a, b, r - 4); ctx.fillStyle = c; ctx.fill(); });
    circle(ctx, -22, -58, 10); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    circle(ctx, 22, -30, 5); ctx.fillStyle = '#ff5e7e'; ctx.fill();
    circle(ctx, -30, -20, 5); ctx.fillStyle = '#ffe14d'; ctx.fill();
  } else if (h.type === 'qblock') {
    const used = h.used;
    rr(ctx, -34, -34, 68, 68, 8); fs(ctx, used ? '#a0602d' : '#ffb81a');
    ctx.fillStyle = used ? '#7a4520' : '#c87800';
    [[-25, -25], [25, -25], [-25, 25], [25, 25]].forEach(([a, b]) => { circle(ctx, a, b, 3.5); ctx.fill(); });
    if (!used) {
      ctx.font = 'bold 46px "Arial Rounded MT Bold", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText('?', 0, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillText('?', 0, 3);
    }
  }
  ctx.restore();
  // hint sparkle for hiders that still hold treasure
  if (!h.used && h.treasure) {
    const p = (t * 0.7 + h.x * 0.013) % 1;
    if (p < 0.35) {
      const k = Math.sin((p / 0.35) * Math.PI);
      const sy = h.type === 'qblock' ? y - 34 : y - 70;
      starPath(ctx, x + 30, sy, 12 * k, 3, 4, 0); ctx.fillStyle = '#fffbd0'; ctx.fill();
    }
  }
}

// ---------------- flame ----------------
export function drawFlame(ctx, x, y, len, t, w = 40) {
  if (len <= 2) return;
  const layers = [['#ff3d1a', 1], ['#ff9a1a', 0.75], ['#ffe14d', 0.5], ['#ffffff', 0.25]];
  for (const [c, k] of layers) {
    const fl = len * k * (0.85 + Math.sin(t * 50 + k * 10) * 0.08 + Math.random() * 0.1);
    const ww = w * (0.4 + k * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - ww / 2, y);
    ctx.quadraticCurveTo(x - ww * 0.6, y + fl * 0.45, x, y + fl);
    ctx.quadraticCurveTo(x + ww * 0.6, y + fl * 0.45, x + ww / 2, y);
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
  }
}

// Pointing hand used for hints.
export function drawHand(ctx, x, y, s = 1, press = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 - press * 0.1), s * (1 - press * 0.1));
  ctx.rotate(-0.35);
  rr(ctx, -8, -4, 16, 40, 8); fs(ctx, '#ffe0c2');
  rr(ctx, -14, 22, 44, 46, 16); fs(ctx, '#ffe0c2');
  rr(ctx, -16, 70, 48, 14, 4); fs(ctx, '#4d8fe8');
  ctx.restore();
}

// Arrow pointing in a direction (used at screen edges and for "launch now").
export function drawArrow(ctx, x, y, angle, s = 1, color = '#ffe14d') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(0, -26); ctx.lineTo(0, -12); ctx.lineTo(-28, -12); ctx.lineTo(-28, 12); ctx.lineTo(0, 12); ctx.lineTo(0, 26);
  ctx.closePath();
  fs(ctx, color, 5);
  ctx.restore();
}

// ---------------- hats ----------------
// Won with 3-star planets, in this order. 'none' is always available.
export const HATS = ['none', 'party', 'crown', 'pirate', 'chef', 'viking', 'cowboy', 'propeller', 'wizard', 'flower', 'tophat'];

// Origin at the top of the helmet.
export function drawHat(ctx, hat, x, y, s = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round';
  switch (hat) {
    case 'party':
      ctx.beginPath(); ctx.moveTo(-18, 8); ctx.lineTo(0, -40); ctx.lineTo(18, 8); ctx.closePath(); fs(ctx, '#f06fb0');
      ctx.save(); ctx.beginPath(); ctx.moveTo(-18, 8); ctx.lineTo(0, -40); ctx.lineTo(18, 8); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#ffe14d'; for (let i = -3; i < 3; i++) ctx.fillRect(-30, i * 14, 60, 5); ctx.restore();
      circle(ctx, 0, -42, 7); fs(ctx, '#5cc95a', 3);
      break;
    case 'crown':
      ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(-24, -18); ctx.lineTo(-11, -6); ctx.lineTo(0, -24); ctx.lineTo(11, -6); ctx.lineTo(24, -18); ctx.lineTo(22, 8); ctx.closePath();
      fs(ctx, '#ffcc1a'); circle(ctx, 0, -2, 4.5); fs(ctx, '#ff3d5e', 2);
      break;
    case 'pirate':
      ctx.beginPath(); ctx.moveTo(-34, 6); ctx.quadraticCurveTo(-30, -26, 0, -28); ctx.quadraticCurveTo(30, -26, 34, 6); ctx.quadraticCurveTo(0, -6, -34, 6); ctx.closePath();
      fs(ctx, '#2a2438');
      ctx.fillStyle = '#ffffff'; circle(ctx, 0, -14, 6); ctx.fill();
      ctx.fillRect(-7, -9, 4, 3); ctx.fillRect(3, -9, 4, 3);
      break;
    case 'chef':
      rr(ctx, -16, -10, 32, 18, 3); fs(ctx, '#ffffff');
      circle(ctx, -12, -18, 11); fs(ctx, '#ffffff'); circle(ctx, 12, -18, 11); fs(ctx, '#ffffff'); circle(ctx, 0, -26, 13); fs(ctx, '#ffffff');
      break;
    case 'viking':
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sd * 18, -2); ctx.quadraticCurveTo(sd * 40, -10, sd * 34, -36); ctx.quadraticCurveTo(sd * 28, -16, sd * 12, -10); ctx.closePath(); fs(ctx, '#fff4e0');
      }
      ctx.beginPath(); ctx.arc(0, 8, 24, Math.PI, 0); ctx.closePath(); fs(ctx, '#a7b0c2');
      ctx.fillStyle = '#ffcc1a'; ctx.fillRect(-24, 2, 48, 6);
      break;
    case 'cowboy':
      ctx.beginPath(); ctx.ellipse(0, 4, 40, 9, 0, 0, TAU); fs(ctx, '#a0602d');
      ctx.beginPath(); ctx.moveTo(-20, 2); ctx.quadraticCurveTo(-22, -30, -6, -26); ctx.lineTo(0, -20); ctx.lineTo(6, -26); ctx.quadraticCurveTo(22, -30, 20, 2); ctx.closePath(); fs(ctx, '#c47a3a');
      ctx.fillStyle = '#5a3418'; ctx.fillRect(-19, -4, 38, 5);
      break;
    case 'propeller': {
      ctx.beginPath(); ctx.arc(0, 6, 22, Math.PI, 0); ctx.closePath(); fs(ctx, '#3b8fe8');
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(0, 6, 22, Math.PI, Math.PI * 1.33); ctx.lineTo(0, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -24); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      const w = Math.cos(t * 25) * 26;
      ctx.beginPath(); ctx.ellipse(0, -26, Math.abs(w), 5, 0, 0, TAU); fs(ctx, '#e8443a', 3);
      break;
    }
    case 'wizard':
      ctx.beginPath(); ctx.moveTo(-26, 8); ctx.quadraticCurveTo(-4, -20, 8, -52); ctx.quadraticCurveTo(10, -20, 26, 8); ctx.closePath(); fs(ctx, '#6a3fd0');
      ctx.beginPath(); ctx.ellipse(0, 6, 32, 7, 0, 0, TAU); fs(ctx, '#6a3fd0');
      starPath(ctx, 2, -18, 7, 3); fs(ctx, '#ffe14d', 2);
      break;
    case 'flower':
      for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + Math.sin(t * 2) * 0.1; circle(ctx, Math.cos(a) * 12, -14 + Math.sin(a) * 12, 9); fs(ctx, '#ff7ab8', 3); }
      circle(ctx, 0, -14, 8); fs(ctx, '#ffe14d', 3);
      break;
    case 'tophat':
      ctx.beginPath(); ctx.ellipse(0, 4, 30, 7, 0, 0, TAU); fs(ctx, '#2a2438');
      rr(ctx, -18, -36, 36, 40, 4); fs(ctx, '#2a2438');
      ctx.fillStyle = '#e8443a'; ctx.fillRect(-18, -8, 36, 7);
      break;
  }
  ctx.restore();
}

// ---------------- alien buddy ----------------
// Small green alien. Origin at its feet, about 60 tall.
export function drawAlien(ctx, x, y, o = {}) {
  const t = o.t || 0, dir = o.dir || 1, s = o.scale || 1;
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir * s, s);
  if (o.rot) ctx.rotate(o.rot);
  const squash = o.squash || 0;
  ctx.scale(1 + squash * 0.25, 1 - squash * 0.25);
  // feet
  const step = o.walking ? Math.sin(t * 16) * 5 : 0;
  ellipse(ctx, -9 + step, -3, 8, 5); fs(ctx, '#3fa34d', 3);
  ellipse(ctx, 9 - step, -3, 8, 5); fs(ctx, '#3fa34d', 3);
  // body
  ellipse(ctx, 0, -26, 22, 24); fs(ctx, '#7bd36b');
  ellipse(ctx, -7, -34, 6, 8); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  // antennae
  for (const sd of [-1, 1]) {
    const wob = Math.sin(t * 5 + sd) * 3;
    ctx.beginPath(); ctx.moveTo(sd * 8, -46); ctx.quadraticCurveTo(sd * 14, -58, sd * 16 + wob, -64); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, sd * 16 + wob, -66, 5); fs(ctx, '#ffe14d', 3);
  }
  // one big eye
  if (o.dizzy) {
    circle(ctx, 2, -30, 11); fs(ctx, '#ffffff', 3);
    ctx.beginPath(); for (let a = 0; a < 10; a += 0.4) ctx.lineTo(2 + Math.cos(a + t * 8) * a * 0.9, -30 + Math.sin(a + t * 8) * a * 0.9);
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  } else if (o.happy || o.sneeze) {
    ctx.beginPath(); ctx.arc(2, -28, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  } else {
    circle(ctx, 2, -30, 11); fs(ctx, '#ffffff', 3);
    circle(ctx, 5, -29, 5); ctx.fillStyle = INK; ctx.fill();
    circle(ctx, 7, -31, 1.8); ctx.fillStyle = '#fff'; ctx.fill();
  }
  // mouth
  ctx.beginPath();
  if (o.sneeze) { ellipse(ctx, 4, -14, 5, 6); ctx.fillStyle = INK; ctx.fill(); }
  else { ctx.arc(3, -16, 6, 0.2, Math.PI - 0.2); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  if (o.hat && o.hat !== 'none') drawHat(ctx, o.hat, 0, -48, 0.6, t);
  ctx.restore();
}
