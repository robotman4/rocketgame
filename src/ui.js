// Round icon buttons. No text, only symbols.
import { INK, circle, fs, rr, starPath } from './draw.js';
import { V, dist, shade } from './core.js';
import { isMuted } from './audio.js';

export class Button {
  constructor(icon, color, r = 44) {
    this.icon = icon; this.color = color; this.r0 = r;
    this.x = 0; this.y = 0; this.enabled = true; this.pulse = false; this.pressed = 0; this.visible = true;
  }
  // Buttons grow on small (phone) screens so they stay easy to hit.
  get r() { return this.r0 * V.ui; }
  hit(p) { return this.visible && this.enabled && dist(p.x, p.y, this.x, this.y) < this.r + 14; }
  draw(ctx, t) {
    if (!this.visible) return;
    const s = (this.pulse ? 1 + Math.sin(t * 6) * 0.07 : 1) * (1 - this.pressed * 0.12);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    if (this.pulse) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.2;
      circle(ctx, 0, 0, this.r + 16); ctx.fillStyle = '#fff27a'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    const col = this.enabled ? this.color : '#9a96a6';
    circle(ctx, 0, 6, this.r); ctx.fillStyle = shade(this.enabled ? this.color : '#9a96a6', -0.35); ctx.fill();
    circle(ctx, 0, 0, this.r); fs(ctx, col, 5);
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.75, Math.PI * 1.1, Math.PI * 1.45); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    drawIcon(ctx, this.icon, this.r, t);
    ctx.restore();
  }
}

export function drawIcon(ctx, icon, r, t = 0) {
  const k = r / 44;
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (icon === 'play' || icon === 'next') {
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(20, 0); ctx.lineTo(-12, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (icon === 'next') { rr(ctx, -24, -18, 8, 36, 3); }
  } else if (icon === 'home') {
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -20); ctx.lineTo(22, 0); ctx.lineTo(16, 0); ctx.lineTo(16, 20); ctx.lineTo(-16, 20); ctx.lineTo(-16, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    rr(ctx, -5, 6, 10, 14, 2); ctx.fillStyle = INK; ctx.fill();
  } else if (icon === 'sound') {
    ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-10, -8); ctx.lineTo(2, -18); ctx.lineTo(2, 18); ctx.lineTo(-10, 8); ctx.lineTo(-20, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (isMuted()) {
      ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(22, 10); ctx.moveTo(22, -10); ctx.lineTo(8, 10); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(4, 0, 10, -0.8, 0.8); ctx.moveTo(4 + Math.cos(-0.8) * 18, Math.sin(-0.8) * 18); ctx.arc(4, 0, 18, -0.8, 0.8);
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
  } else if (icon === 'launch') {
    // little rocket
    ctx.rotate(-0.6);
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(14, -14, 12, 14); ctx.lineTo(-12, 14); ctx.quadraticCurveTo(-14, -14, 0, -28); ctx.closePath();
    ctx.fill(); ctx.stroke();
    circle(ctx, 0, -6, 5); ctx.fillStyle = '#4aa8e0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-20, 18); ctx.lineTo(-10, 14); ctx.moveTo(12, 6); ctx.lineTo(20, 18); ctx.lineTo(10, 14);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 16); ctx.quadraticCurveTo(0, 34 + Math.sin(t * 30) * 4, 7, 16); ctx.fillStyle = '#ffb81a'; ctx.fill(); ctx.stroke();
  } else if (icon === 'retry') {
    ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI * 0.2, Math.PI * 1.5); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(14, -16); ctx.lineTo(0, -8); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
  } else if (icon === 'update') {
    // Arrow down into a tray: "get the new version".
    ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(8, -22); ctx.lineTo(8, -4); ctx.lineTo(18, -4); ctx.lineTo(0, 14); ctx.lineTo(-18, -4); ctx.lineTo(-8, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(-22, 20); ctx.lineTo(22, 20); ctx.lineTo(22, 8);
    ctx.lineWidth = 10; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'star') {
    starPath(ctx, 0, 0, 24, 11); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// Place standard top-right buttons respecting the notch / safe area.
export function layoutTopRight(buttons) {
  let x = V.w - V.safeR - 20 - (buttons[0] ? buttons[0].r : 40);
  for (const b of buttons) { b.x = x; x -= b.r * 2 + 20; }
  for (const b of buttons) b.y = 20 + b.r + V.safeT;
}

export function drawStarIcon(ctx, x, y, r, filled, t = 0) {
  starPath(ctx, x, y, r, r * 0.48);
  fs(ctx, filled ? '#ffe14d' : 'rgba(255,255,255,0.35)', Math.max(3, r * 0.12));
  if (filled) {
    ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.25, Math.PI, Math.PI * 1.5); ctx.lineWidth = r * 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  }
}

// Update button, top-left. Only visible when a new version has been downloaded.
export function updateButton() {
  const b = new Button('update', '#5cc95a', 36);
  b.pulse = true;
  return b;
}
export function layoutTopLeft(b) {
  b.x = V.safeL + 20 + b.r;
  b.y = 20 + b.r + V.safeT;
}
