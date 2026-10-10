// Info panel for parents: what the game is, what it does with data, the disclaimer,
// the version and a "check for updates" button. Opened with the (i) button.
import { V } from './core.js';
import { INK, rr, fs } from './draw.js';
import { Button, tapUpdate } from './ui.js';
import { sfx } from './audio.js';
import { pwa } from './pwa.js';

/* global __APP_VERSION__ */
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const SECTIONS = [
  ['Rocket Hunt', 'Build a rocket, fly to 30 planets and bring the treasures back. Made for kids aged 4–8. Planets 21–30 are harder: two hits from a bug and the planet starts over.'],
  ['Your data', 'No ads, no accounts, no in-app purchases. Nothing is collected or sent anywhere. Progress is saved only on this device; deleting the app or clearing website data removes it. The game works offline once installed.'],
  ['Disclaimer', 'This game is provided "as is", free of charge and without warranty of any kind. You play on your own terms and at your own risk. The makers take no responsibility for any damage, loss or other consequences of using it. Adults are responsible for supervising children and their screen time.'],
];

export class InfoPanel {
  constructor() {
    this.open = false;
    this.k = 0;
    this.close = new Button('close', '#e8443a', 34);
    this.status = null; // null | 'checking' | 'latest' | 'available' | 'error'
    this.updBtn = null;
  }
  show() { this.open = true; this.status = null; sfx('pop'); }
  hide() { this.open = false; sfx('tap'); }

  layout() {
    // Phones show the game smaller, so the panel text is made bigger there.
    this.f = V.ui > 1 ? 1.5 : 1;
    const w = Math.min(820 * this.f, V.w - V.safeL - V.safeR - 60), h = 700;
    const x = (V.w - w) / 2, y = (V.h - h) / 2;
    this.box = { x, y, w, h };
    this.close.x = x + w - 26; this.close.y = y + 26;
    this.checkBtn = { x: x + 40, y: y + h - 92, w: 330 * Math.min(this.f, 1.3), h: 62 * Math.min(this.f, 1.2) };
  }

  // Returns true when the panel handled the tap (always while it is open).
  onDown(p, fx) {
    if (!this.open) return false;
    this.layout();
    const b = this.box, c = this.checkBtn;
    if (this.close.hit(p)) { this.hide(); return true; }
    if (this.updBtn && this.status === 'available' && this.updBtn.hit(p)) { tapUpdate(this.updBtn, fx); return true; }
    if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h && this.status !== 'checking') {
      sfx('tap');
      this.status = 'checking';
      pwa.check().then((r) => { this.status = r; if (r === 'available') sfx('ready'); });
      return true;
    }
    // Tapping outside the panel closes it.
    if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) this.hide();
    return true;
  }

  update(dt) { this.k += ((this.open ? 1 : 0) - this.k) * Math.min(1, dt * 12); }

  draw(ctx, t) {
    if (this.k < 0.01) return;
    this.layout();
    const { x, y, w, h } = this.box;
    ctx.save();
    ctx.globalAlpha = this.k;
    ctx.fillStyle = 'rgba(20,14,40,0.6)'; ctx.fillRect(0, 0, V.w, V.h);
    ctx.translate(V.w / 2, V.h / 2); ctx.scale(0.9 + this.k * 0.1, 0.9 + this.k * 0.1); ctx.translate(-V.w / 2, -V.h / 2);
    rr(ctx, x, y, w, h, 28); fs(ctx, '#fff8e8', 6);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const f = this.f;
    let ty = y + 30;
    for (const [title, body] of SECTIONS) {
      ctx.fillStyle = INK; ctx.font = `800 ${26 * f}px "Arial Rounded MT Bold", Arial, sans-serif`;
      ctx.fillText(title, x + 40, ty); ty += 34 * f;
      ctx.font = `${19 * f}px Arial, sans-serif`; ctx.fillStyle = '#3a3050';
      for (const line of wrap(ctx, body, w - 110)) { ctx.fillText(line, x + 40, ty); ty += 24 * f; }
      ty += 12 * f;
    }
    ctx.font = `${16 * f}px Arial, sans-serif`; ctx.fillStyle = '#7a7090';
    ctx.fillText(`Version ${VERSION}`, x + 40, y + h - 128);
    // Check for updates
    const c = this.checkBtn;
    rr(ctx, c.x, c.y, c.w, c.h, 31); fs(ctx, this.status === 'checking' ? '#9a96a6' : '#3b8fe8', 5);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 ${22 * Math.min(f, 1.3)}px "Arial Rounded MT Bold", Arial, sans-serif`; ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(this.status === 'checking' ? 'Checking…' : 'Check for updates', c.x + c.w / 2, c.y + c.h / 2 + 1);
    ctx.textAlign = 'left';
    const msg = { latest: '✓ You have the latest version', available: 'New version ready! Tap to update →', error: 'Could not check. Are you online?' }[this.status];
    if (msg) {
      ctx.font = `700 ${19 * f}px Arial, sans-serif`; ctx.fillStyle = this.status === 'error' ? '#c0392b' : '#2f8a3a';
      ctx.fillText(msg, c.x + c.w + 20, c.y + c.h / 2);
    }
    if (this.status === 'available') {
      if (!this.updBtn) { this.updBtn = new Button('update', '#5cc95a', 34); this.updBtn.pulse = true; }
      this.updBtn.x = x + w - 60; this.updBtn.y = c.y + c.h / 2;
      this.updBtn.draw(ctx, t);
    }
    this.close.draw(ctx, t);
    ctx.restore();
  }
}

function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
