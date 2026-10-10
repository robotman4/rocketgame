// "New version!" present on the title screen after an update.
// The player taps the present (which also lets iOS start the sound), it bursts open with
// confetti, fireworks and a fanfare, and a shiny new rocket shoots out of it.
import { V, R, ease, Tweens, TAU } from './core.js';
import { INK, rr, fs, circle, drawHand, drawFlame } from './draw.js';
import { drawRocket, randomPart, DRAW_ORDER, FINISHES } from './rocket.js';
import { Particles } from './particles.js';
import { sfx } from './audio.js';

export class Gift {
  constructor() {
    this.t = 0;
    this.state = 'wait';
    this.fx = new Particles();
    this.tw = new Tweens();
    this.lid = { y: 0, rot: 0, x: 0 };
    this.rocket = { y: 0, s: 0.2 };
    this.alpha = 1;
    // The rocket that pops out gets a special finish on one part.
    this.cfg = {};
    for (const s of DRAW_ORDER) this.cfg[s] = randomPart(s, R);
    const special = R.pick(DRAW_ORDER);
    this.cfg[special] = { ...this.cfg[special], color: '#f2f2f2', finish: R.pick(FINISHES) };
  }

  get done() { return this.state === 'gone'; }
  get pos() { return { x: V.w / 2, y: 470 }; }

  onDown() {
    if (this.state !== 'wait') return this.state !== 'gone';
    this.open();
    return true;
  }

  open() {
    const { x, y } = this.pos;
    this.state = 'open'; this.openT = 0;
    sfx('pop'); sfx('fanfare');
    this.tw.add(this.lid, { y: -420, x: 160, rot: 2.5 }, 0.9, { ease: ease.outQuad });
    // Pop up out of the box, hover a moment, then zoom off the top.
    this.tw.add(this.rocket, { y: -170, s: 0.5 }, 0.9, { delay: 0.15, ease: ease.outBack });
    this.tw.add(this.rocket, { y: -1200 }, 0.8, { delay: 2.7, ease: ease.inQuad });
    setTimeout(() => sfx('whoosh'), 2700);
    this.fx.confetti(x, y - 60, 90);
    this.fx.burst(x, y - 60, 24);
  }

  update(dt) {
    this.t += dt;
    this.tw.update(dt);
    this.fx.update(dt);
    if (this.state === 'open') {
      this.openT += dt;
      // A few rounds of fireworks while the rocket flies.
      if (this.openT < 3.2 && Math.floor((this.openT - dt) / 0.35) !== Math.floor(this.openT / 0.35)) {
        this.fx.firework(R.range(120, V.w - 120), R.range(90, 330));
        sfx('pop');
        if (Math.random() < 0.5) sfx('star', R.int(0, 2));
      }
      if (this.openT > 1.2 && this.openT < 1.25) this.fx.confetti(V.w / 2, 200, 60);
      if (this.openT > 3.8) { this.alpha = Math.max(0, this.alpha - dt * 2); if (this.alpha <= 0) this.state = 'gone'; }
    }
  }

  draw(ctx, t) {
    if (this.state === 'gone') return;
    const { x, y } = this.pos;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = 'rgba(20,14,40,0.55)'; ctx.fillRect(0, 0, V.w, V.h);
    // Spinning light rays
    ctx.save(); ctx.translate(x, y - 40); ctx.rotate(t * 0.5);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -360); ctx.lineTo(30, -360); ctx.closePath();
      ctx.fillStyle = 'rgba(255,220,90,0.18)'; ctx.fill();
    }
    ctx.restore();
    // The box: shakes now and then while waiting
    const shake = this.state === 'wait' && (t % 1.4) < 0.4 ? Math.sin(t * 50) * 0.08 : 0;
    const hop = this.state === 'wait' ? Math.abs(Math.sin(t * 3)) * 10 : 0;
    ctx.save(); ctx.translate(x, y - hop); ctx.rotate(shake);
    rr(ctx, -90, -110, 180, 120, 10); fs(ctx, '#e8443a', 6);
    ctx.fillStyle = '#ffcc1a'; ctx.fillRect(-18, -110, 36, 120);
    rr(ctx, -90, -110, 180, 120, 10); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    // lid + bow (fly off when opened)
    ctx.save(); ctx.translate(this.lid.x, this.lid.y); ctx.rotate(this.lid.rot);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 34, -152, 36, 22, s * 0.5, 0, TAU); fs(ctx, '#ffcc1a', 5);
    }
    circle(ctx, 0, -146, 14); fs(ctx, '#ffcc1a', 5);
    rr(ctx, -102, -140, 204, 40, 10); fs(ctx, '#ff5e5e', 6);
    ctx.fillStyle = '#ffcc1a'; ctx.fillRect(-18, -137, 36, 34);
    rr(ctx, -102, -140, 204, 40, 10); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    ctx.restore();
    // Rocket shooting out of the box, in front of it.
    if (this.state === 'open') {
      const ry = y - 60 + this.rocket.y + Math.sin(t * 6) * 6;
      drawFlame(ctx, x, ry, 160 * this.rocket.s, t, 90 * this.rocket.s);
      drawRocket(ctx, x, ry, this.cfg, { scale: this.rocket.s, crew: true });
    }
    this.fx.draw(ctx);
    if (this.state === 'wait' && this.t > 2) drawHand(ctx, x + 40, y - 20, 1.1, Math.sin(t * 8) > 0 ? 1 : 0);
    ctx.restore();
  }
}
