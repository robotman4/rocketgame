// Simple particle system for smoke, sparks, confetti and dust. World coordinates.
import { circle, starPath, INK } from './draw.js';
import { R, TAU } from './core.js';

const CONFETTI = ['#e8443a', '#f7d43c', '#5cc95a', '#3b8fe8', '#f06fb0', '#9b5de5'];

export class Particles {
  constructor() { this.list = []; }

  smoke(x, y, o = {}) {
    this.list.push({
      kind: 'smoke', x, y,
      vx: o.vx ?? R.range(-60, 60), vy: o.vy ?? R.range(-20, 40),
      r: o.r ?? R.range(14, 26), grow: o.grow ?? R.range(30, 60),
      life: o.life ?? R.range(1.4, 2.6), age: 0,
      c: o.c || R.pick(['#ffffff', '#eeeeee', '#dcdce4', '#c8c8d2']),
      drag: o.drag ?? 1.2,
    });
  }
  spark(x, y, o = {}) {
    const a = o.a ?? R.range(0, TAU), sp = o.sp ?? R.range(120, 320);
    this.list.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: o.r ?? R.range(4, 8), life: o.life ?? R.range(0.4, 0.8), age: 0, c: o.c || R.pick(['#ffe14d', '#fff7c2', '#ffb81a']), g: o.g ?? 300, drag: 0.5 });
  }
  star(x, y, o = {}) {
    const a = o.a ?? R.range(0, TAU), sp = o.sp ?? R.range(100, 260);
    this.list.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: o.r ?? R.range(8, 14), life: o.life ?? R.range(0.6, 1.0), age: 0, c: o.c || '#ffe14d', g: o.g ?? 200, drag: 1, spin: R.range(-6, 6) });
  }
  confetti(x, y, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = R.range(-Math.PI * 0.9, -Math.PI * 0.1), sp = R.range(250, 650);
      this.list.push({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R.range(6, 10), life: R.range(1.8, 3), age: 0, c: R.pick(CONFETTI), g: 500, drag: 1.5, spin: R.range(-10, 10), rot: R.range(0, TAU) });
    }
  }
  // Hollow smoke ring that grows and fades (for the rocket's hiccup).
  ring(x, y, o = {}) {
    this.list.push({ kind: 'ring', x, y, vx: o.vx ?? 0, vy: o.vy ?? 60, r: o.r ?? 18, grow: o.grow ?? 70, life: o.life ?? 1.6, age: 0, drag: 0.8 });
  }
  firework(x, y) {
    const c = R.pick(CONFETTI);
    for (let i = 0; i < 36; i++) this.spark(x, y, { a: (i / 36) * TAU, sp: R.range(220, 320), c, g: 120, life: R.range(0.8, 1.3), r: 6 });
  }
  burst(x, y, n = 12) { for (let i = 0; i < n; i++) this.star(x, y); }
  dust(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.smoke(x + R.range(-20, 20), y, { vx: R.range(-120, 120), vy: R.range(-60, -10), r: R.range(6, 12), grow: 20, life: R.range(0.4, 0.8), c: 'rgba(230,220,210,1)' });
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      const d = Math.exp(-(p.drag || 0) * dt);
      p.vx *= d; p.vy *= d;
      if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.r += p.grow * dt;
      if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(ctx, camX = 0, camY = 0, filter) {
    for (const p of this.list) {
      if (filter && p.kind !== filter) continue;
      const k = p.age / p.life, x = p.x - camX, y = p.y - camY;
      if (p.kind === 'smoke') {
        ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
        circle(ctx, x, y, p.r); ctx.fillStyle = p.c; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,80,110,0.35)'; ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.beginPath(); ctx.ellipse(x, y, p.r, p.r * 0.45, 0, 0, TAU);
        ctx.lineWidth = 12 * (1 - k * 0.5); ctx.strokeStyle = '#e8e8f0'; ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,80,110,0.5)'; ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = Math.max(0, 1 - k);
        circle(ctx, x, y, p.r * (1 - k * 0.5)); ctx.fillStyle = p.c; ctx.fill();
      } else if (p.kind === 'star') {
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot || 0);
        starPath(ctx, 0, 0, p.r, p.r * 0.45); ctx.fillStyle = p.c; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.7) / 0.3);
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2 + Math.abs(Math.sin(p.rot)) * p.r / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
