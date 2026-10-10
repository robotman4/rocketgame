// Boarding, countdown, liftoff with fire and smoke, space trip and landing on the next planet.
import { V, R, clamp, ease, Tweens, TAU } from '../core.js';
import { World, drawStars } from '../world.js';
import { drawRocket, drawPad, HATCH } from '../rocket.js';
import { drawAstronaut, drawFlame, INK } from '../draw.js';
import { sfx, rumble, playMusic, stopMusic } from '../audio.js';
import { Particles } from '../particles.js';
import { PlanetScene } from './planet.js';
import { drawPlanet } from './map.js';

export const CREW_COLORS = ['#f5962a', '#5cc95a', '#9b5de5'];

export class FlightScene {
  constructor(game, { from, to, cfg, world }) {
    this.game = game;
    this.from = from; this.to = to; this.cfg = cfg;
    this.fromWorld = world || new World(from);
    this.toWorld = new World(to);
    this.rx = this.fromWorld.rocketX;
    this.ry = this.fromWorld.groundAt(this.rx) - (from === 0 ? 22 : 0);
    this.rocket = { y: this.ry, vy: 0, screenOff: 0 };
    this.t = 0; this.pt = 0;
    this.phase = 'board';
    this.tw = new Tweens();
    this.fx = new Particles();
    this.hatch = { v: 0 };
    this.shake = 0;
    this.camY = 0;
    this.flame = 0;
    this.crew = CREW_COLORS.map((color, i) => ({ x: -70 - i * 110, y: 0, s: 1, color, state: 'run', visible: true }));
    this.tw.add(this.hatch, { v: 1 }, 0.4);
  }
  enter() {}

  groundFrom(x) {
    if (this.from === 0 && Math.abs(x - this.rx) < 140) return this.ry;
    return this.fromWorld.groundAt(x);
  }

  setPhase(p) { this.phase = p; this.pt = 0; }

  update(dt) {
    this.t += dt; this.pt += dt;
    this.tw.update(dt);
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 6);
    const r = this.rocket;
    const nozzleY = r.y + 4;

    if (this.phase === 'board') {
      for (const c of this.crew) {
        if (c.state === 'run') {
          c.x += 330 * dt;
          c.y = this.groundFrom(c.x);
          if (c.x >= this.rx - 50) {
            c.state = 'jump';
            sfx('jump');
            this.tw.add(c, { x: this.rx + HATCH.x, y: this.ry + HATCH.y + 50, s: 0.35 }, 0.45, {
              arc: 110, ease: ease.inOutQuad,
              onDone: () => { c.visible = false; sfx('pop'); this.fx.burst(this.rx, this.ry + HATCH.y, 8); },
            });
          }
        }
      }
      if (this.crew.every((c) => !c.visible) && !this.closing) {
        this.closing = true;
        this.tw.add(this.hatch, { v: 0 }, 0.3, { delay: 0.2, onDone: () => { stopMusic(); this.setPhase('count'); this.lastBeep = -1; } });
      }
    } else if (this.phase === 'count') {
      const n = Math.floor(this.pt);
      if (n !== this.lastBeep && n < 3) { this.lastBeep = n; sfx('beep'); }
      if (this.pt > 1.4 && R() < 0.5) this.fx.smoke(this.rx + R.range(-40, 40), nozzleY, { vx: R.range(-120, 120), vy: R.range(-40, 0), r: 12, grow: 25, life: 1.4 });
      if (this.pt > 2.3) { this.flame = 25 + Math.random() * 15; this.shake = Math.max(this.shake, 1.5); }
      if (this.pt >= 3) {
        sfx('beepHigh');
        this.stopRumble = rumble(6);
        this.setPhase('lift');
      }
    } else if (this.phase === 'lift') {
      const acc = 140 + this.pt * 300;
      r.vy -= acc * dt;
      r.y += r.vy * dt;
      this.flame = 150 + Math.sin(this.t * 30) * 10;
      this.shake = Math.max(this.shake, Math.max(0, 6 - this.pt * 2.5));
      const alt = this.ry - r.y;
      this.spawnSmoke(alt, nozzleY, this.ry);
      if (alt > 3400) {
        if (this.stopRumble) this.stopRumble(1.2);
        playMusic('space');
        this.setPhase('cruise');
      }
    } else if (this.phase === 'cruise') {
      r.vy = -1800;
      r.y += r.vy * dt;
      this.flame = 130 + Math.sin(this.t * 30) * 10;
      if (R() < 0.6) this.fx.smoke(this.rx + R.range(-15, 15), nozzleY + 20, { vx: R.range(-30, 30), vy: 100, r: 10, grow: 30, life: 0.8 });
      if (this.pt > 2.2) {
        if (!this.whooshed) { this.whooshed = true; sfx('whoosh'); }
        r.screenOff -= (900 + this.pt * 600) * dt * ((this.pt - 2.2) * 4);
      }
      if (this.pt > 3.0) {
        // Arrive above the new planet.
        this.fx.list = [];
        this.toGround = this.toWorld.groundAt(this.rx);
        r.y = this.toGround - 3300;
        r.screenOff = 0;
        this.setPhase('descend');
        this.stopRumble = rumble(6);
        stopMusic();
      }
    } else if (this.phase === 'descend') {
      const D = 4.6;
      const k = clamp(this.pt / D, 0, 1);
      r.y = this.toGround - 3300 * (1 - ease.outQuad(k)) - 0;
      r.screenOff = -800 * Math.pow(1 - clamp(this.pt / 0.9, 0, 1), 2);
      const alt = this.toGround - r.y;
      this.flame = 70 + (1 - k) * 60 + Math.sin(this.t * 30) * 8;
      this.spawnSmoke(alt, r.y + 4, this.toGround);
      if (alt < 250) this.shake = Math.max(this.shake, 2);
      if (k >= 1) {
        r.y = this.toGround;
        if (this.stopRumble) this.stopRumble(0.3);
        sfx('thud');
        this.shake = 10;
        this.flame = 0;
        for (let i = 0; i < 30; i++) {
          const side = i % 2 ? 1 : -1;
          this.fx.smoke(this.rx + side * R.range(20, 80), this.toGround - 10, { vx: side * R.range(150, 420), vy: R.range(-60, 0), r: R.range(16, 30), grow: 40, life: R.range(1.2, 2.2), drag: 2 });
        }
        this.setPhase('land');
      }
    } else if (this.phase === 'land') {
      if (this.pt > 1.1 && !this.done) {
        this.done = true;
        const next = new PlanetScene(this.game, this.to, this.cfg, { fx: this.fx });
        this.game.scene = next;
        next.enter();
      }
    }

    // Camera follows the rocket when it is high up.
    this.camY = Math.min(0, r.y - V.h * 0.62);
  }

  spawnSmoke(alt, nozzleY, groundY) {
    for (let i = 0; i < 3; i++) {
      if (alt < 260) {
        // Big clouds rolling along the ground.
        const side = R() < 0.5 ? -1 : 1;
        this.fx.smoke(this.rx + side * R.range(10, 60), groundY - R.range(0, 20), {
          vx: side * R.range(120, 380), vy: R.range(-50, 0), r: R.range(18, 34), grow: R.range(40, 70), life: R.range(2, 3.4), drag: 1.4,
        });
      } else {
        this.fx.smoke(this.rx + R.range(-20, 20), nozzleY + 30, { vx: R.range(-50, 50), vy: R.range(40, 160), r: R.range(14, 22), grow: 45, life: R.range(1.2, 2) });
      }
    }
    if (R() < 0.7) this.fx.spark(this.rx + R.range(-20, 20), nozzleY + 40, { a: Math.PI / 2 + R.range(-0.5, 0.5), sp: R.range(200, 400), g: 200, r: 5 });
  }

  draw(ctx) {
    const t = this.t, r = this.rocket;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    const landing = this.phase === 'descend' || this.phase === 'land';
    const world = landing ? this.toWorld : this.fromWorld;
    const groundY = landing ? this.toGround : this.ry;
    const alt = groundY - r.y;
    const spaceMix = this.phase === 'cruise' ? 1 : clamp((alt - 300) / 2500, 0, 1);
    if (spaceMix >= 1) {
      this.drawSpace(ctx);
    } else {
      world.drawBackground(ctx, 0, this.camY, t, spaceMix);
      if (!landing && this.from === 0) drawPad(ctx, this.rx, this.ry - this.camY);
    }
    if (spaceMix > 0.3) this.drawSpeedLines(ctx, spaceMix);
    if (this.phase === 'cruise') {
      const k = this.pt / 3;
      drawPlanet(ctx, this.to, V.w * 0.22, -150 + k * (V.h + 300), 80, t, false);
    }

    this.fx.draw(ctx, 0, this.camY);

    const ry = r.y - this.camY + r.screenOff;
    drawFlame(ctx, this.rx, ry - 4, this.flame, t, 72);
    drawRocket(ctx, this.rx, ry, this.cfg, { crew: this.phase !== 'board', hatch: this.hatch.v > 0.01 ? this.hatch.v : 0 });

    for (const c of this.crew) {
      if (!c.visible) continue;
      drawAstronaut(ctx, c.x, c.y - this.camY, { t, color: c.color, walking: c.state === 'run', phase: t * 16 + c.x * 0.02, scale: c.s, dir: 1 });
    }
    ctx.restore();

    if (this.phase === 'count') {
      const n = 3 - Math.floor(this.pt);
      if (n >= 1) {
        const f = this.pt % 1;
        const s = 0.6 + ease.outBack(Math.min(1, f * 3)) * 0.6;
        ctx.save();
        ctx.translate(V.w / 2 - 260, 260);
        ctx.scale(s, s);
        ctx.globalAlpha = f > 0.8 ? (1 - f) * 5 : 1;
        ctx.font = '900 180px "Arial Rounded MT Bold", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 18; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
        ctx.strokeText(String(n), 0, 0);
        ctx.fillStyle = ['#5cc95a', '#f7d43c', '#e8443a'][n - 1];
        ctx.fillText(String(n), 0, 0);
        ctx.restore();
      }
    }
  }

  drawSpace(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#05051a'); g.addColorStop(1, '#1a1446');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    drawStars(ctx, 0, this.camY * 0.05, this.t, 1);
  }

  drawSpeedLines(ctx, a) {
    const speed = Math.abs(this.rocket.vy) + (this.phase === 'descend' ? 1500 : 0);
    const dir = this.phase === 'descend' ? -1 : 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const h = Math.sin(i * 91.7) * 43758.5453, fx = h - Math.floor(h);
      const h2 = Math.sin(i * 12.3) * 9631.17, fy = h2 - Math.floor(h2);
      const x = fx * V.w;
      const y = (((fy * V.h + dir * this.t * speed * 0.5) % V.h) + V.h) % V.h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - dir * Math.min(120, speed * 0.04)); ctx.stroke();
    }
  }
}
