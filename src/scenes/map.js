// Star map with the 20 planets. Drag sideways to scroll, tap an unlocked planet to go there.
import { V, clamp, TAU, shade } from '../core.js';
import { themeFor, drawStars } from '../world.js';
import { INK, circle, ellipse, fs, rr, drawArrow } from '../draw.js';
import { Button, layoutTopRight, updateButton, layoutTopLeft, drawStarIcon } from '../ui.js';
import { drawRocket, randomPart, DRAW_ORDER } from '../rocket.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { save, LEVELS } from '../storage.js';
import { Particles } from '../particles.js';
import { pwa } from '../pwa.js';
import { BuildScene } from './build.js';
import { TitleScene } from './title.js';

const SPACING = 200;

export class MapScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.updBtn = updateButton();
    this.fx = new Particles();
    this.cfg = {};
    for (const s of DRAW_ORDER) this.cfg[s] = randomPart(s);
    this.vel = 0;
    this.drag = null;
    this.onResize();
    const cur = this.pos(Math.min(save.unlocked, LEVELS));
    this.scroll = clamp(cur.x - V.w / 2, 0, this.maxScroll());
  }
  onResize() {
    layoutTopLeft(this.updBtn);
    layoutTopRight([this.sound, this.home]);
  }
  enter() { playMusic('map'); }
  pos(i) {
    return { x: 160 + i * SPACING, y: 420 + Math.sin(i * 0.95) * 140, r: i === 0 ? 70 : 54 + (i % 3) * 6 };
  }
  maxScroll() { return Math.max(0, this.pos(LEVELS).x + 180 - V.w); }

  onDown(p) {
    this.updBtn.visible = pwa.ready;
    if (this.updBtn.hit(p)) { sfx('pop'); pwa.apply(); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new TitleScene(this.game)); return; }
    this.drag = { x0: p.x, last: p.x, s0: this.scroll, moved: 0, t: performance.now() };
    this.vel = 0;
  }
  onMove(p) {
    if (!this.drag) return;
    const d = p.x - this.drag.last;
    this.drag.last = p.x;
    this.drag.moved = Math.max(this.drag.moved, Math.abs(p.x - this.drag.x0));
    this.scroll = clamp(this.scroll - d, -60, this.maxScroll() + 60);
    this.vel = -d / 0.016;
  }
  onUp(p) {
    if (!this.drag) return;
    const tap = this.drag.moved < 16;
    this.drag = null;
    if (!tap) return;
    this.vel = 0;
    for (let i = 1; i <= LEVELS; i++) {
      const q = this.pos(i);
      if (Math.hypot(p.x - (q.x - this.scroll), p.y - q.y) < q.r + 24) {
        if (i <= save.unlocked) {
          sfx('pop');
          this.fx.burst(p.x, p.y, 14);
          this.game.go(new BuildScene(this.game, i));
        } else {
          sfx('bounce');
          this.shake = { i, t: 0.4 };
        }
        return;
      }
    }
  }

  update(dt) {
    this.t += dt;
    this.fx.update(dt);
    if (!this.drag) {
      this.scroll += this.vel * dt;
      this.vel *= Math.exp(-4 * dt);
      const max = this.maxScroll();
      if (this.scroll < 0) this.scroll += (0 - this.scroll) * Math.min(1, dt * 10);
      if (this.scroll > max) this.scroll += (max - this.scroll) * Math.min(1, dt * 10);
    }
    if (this.shake) { this.shake.t -= dt; if (this.shake.t <= 0) this.shake = null; }
  }

  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#0d0b2e'); g.addColorStop(1, '#3a2470');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    // nebula blobs
    for (let i = 0; i < 6; i++) {
      const x = ((i * 523 - this.scroll * 0.3) % (V.w + 600) + V.w + 600) % (V.w + 600) - 300;
      const ng = ctx.createRadialGradient(x, 200 + (i % 3) * 180, 10, x, 200 + (i % 3) * 180, 260);
      ng.addColorStop(0, ['rgba(255,94,196,0.18)', 'rgba(62,224,255,0.15)', 'rgba(155,93,229,0.2)'][i % 3]);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng; ctx.fillRect(x - 260, 0, 520, V.h);
    }
    drawStars(ctx, this.scroll * 0.2, 0, t, 1);

    // dotted path
    ctx.save();
    ctx.setLineDash([4, 18]); ctx.lineCap = 'round'; ctx.lineWidth = 8;
    ctx.beginPath();
    for (let i = 0; i <= LEVELS; i++) {
      const q = this.pos(i);
      i ? ctx.lineTo(q.x - this.scroll, q.y) : ctx.moveTo(q.x - this.scroll, q.y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.restore();

    for (let i = 0; i <= LEVELS; i++) {
      const q = this.pos(i);
      let x = q.x - this.scroll;
      if (x < -150 || x > V.w + 150) continue;
      if (this.shake && this.shake.i === i) x += Math.sin(this.shake.t * 60) * 8;
      const locked = i > save.unlocked;
      const current = i === save.unlocked && !save.stars[i];
      const bob = Math.sin(t * 1.5 + i) * 5;
      drawPlanet(ctx, i, x, q.y + bob, q.r, t, locked);
      if (current) {
        ctx.globalAlpha = 0.4 + Math.sin(t * 5) * 0.25;
        circle(ctx, x, q.y + bob, q.r + 16 + Math.sin(t * 5) * 4);
        ctx.lineWidth = 8; ctx.strokeStyle = '#fff27a'; ctx.stroke();
        ctx.globalAlpha = 1;
        drawArrow(ctx, x, q.y + bob - q.r - 60 + Math.sin(t * 6) * 10, Math.PI / 2, 1);
      }
      if (i > 0 && !locked) {
        for (let k = 0; k < 3; k++) drawStarIcon(ctx, x - 34 + k * 34, q.y + bob + q.r + 30, 15, save.stars[i] > k);
      }
    }
    // Rocket parked at the last planet reached.
    const at = this.pos(Math.max(0, save.unlocked - 1));
    const rxp = at.x - this.scroll + at.r * 0.7, ryp = at.y - at.r * 0.6 + Math.sin(t * 2) * 4;
    drawRocket(ctx, rxp, ryp, this.cfg, { scale: 0.22, rot: 0.3 });

    this.fx.draw(ctx);
    this.home.draw(ctx, t);
    this.updBtn.visible = pwa.ready;
    this.updBtn.draw(ctx, t);
    this.sound.draw(ctx, t);
  }
}

export function drawPlanet(ctx, i, x, y, r, t, locked) {
  const th = themeFor(i);
  const [base, spot] = th.planet;
  const ring = th.feature === 'rings' || i % 4 === 2;
  if (ring) {
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.38, -0.25, Math.PI, TAU);
    ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = shade(spot, 0.3); ctx.stroke();
  }
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(base, 0.35)); g.addColorStop(1, th.night ? shade(base, -0.45) : shade(base, -0.15));
  fs(ctx, g, 5);
  ctx.save(); circle(ctx, x, y, r); ctx.clip();
  ctx.fillStyle = th.night ? shade(spot, -0.3) : spot;
  for (let k = 0; k < 4; k++) {
    const a = k * 1.9 + i, d = r * (0.25 + (k % 2) * 0.35);
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.28, r * 0.18, a); ctx.fill();
  }
  ctx.restore();
  circle(ctx, x, y, r); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  if (ring) {
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.38, -0.25, 0, Math.PI);
    ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = shade(spot, 0.3); ctx.stroke();
  }
  if (th.night && !locked) {
    ctx.fillStyle = '#fff6b0';
    ellipse(ctx, x + r * 0.55, y - r * 0.55, 8, 8); ctx.fill();
  }
  if (locked) {
    circle(ctx, x, y, r); ctx.fillStyle = 'rgba(20,14,40,0.55)'; ctx.fill();
    // padlock
    ctx.beginPath(); ctx.arc(x, y - 8, 12, Math.PI, 0); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#d0d0e0'; ctx.stroke();
    rr(ctx, x - 18, y - 8, 36, 28, 6); fs(ctx, '#ffcc1a', 4);
    circle(ctx, x, y + 4, 4); ctx.fillStyle = INK; ctx.fill();
  } else {
    // happy face on every unlocked planet
    ctx.fillStyle = INK;
    ellipse(ctx, x - r * 0.25, y - r * 0.1, r * 0.07, r * 0.12); ctx.fill();
    ellipse(ctx, x + r * 0.25, y - r * 0.1, r * 0.07, r * 0.12); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + r * 0.08, r * 0.25, 0.3, Math.PI - 0.3); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  }
}
