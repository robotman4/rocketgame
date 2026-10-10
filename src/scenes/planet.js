// Treasure hunt on a planet. Tap to walk, collect treasures, bring them back to the rocket.
import { V, R, rng, clamp, dist, ease, Tweens, TAU } from '../core.js';
import { World } from '../world.js';
import { drawRocket, HATCH } from '../rocket.js';
import { drawAstronaut, drawBeetle, drawFly, drawTreasure, drawHider, drawArrow, drawHand, TREASURES, circle, fs, INK, rr } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { sfx, playMusic, toggleMute } from '../audio.js';
import { Particles } from '../particles.js';
import { recordLevel, LEVELS } from '../storage.js';
import { CREW_COLORS } from './flight.js';
import { BuildScene } from './build.js';
import { MapScene } from './map.js';
import { FinaleScene } from './finale.js';

const SPEED = 300;
const QBLOCK_H = 205;

// How a level is put together. Gets a bit bigger and busier every planet.
export function levelSpec(level) {
  return {
    treasures: 3 + Math.floor((level - 1) / 4),
    hidden: Math.min(2 + Math.floor((level - 1) / 4), Math.floor(level / 2.5)),
    beetles: level >= 3 ? 1 + Math.floor((level - 3) / 8) : 0,
    flies: level >= 6 ? 1 + Math.floor((level - 6) / 8) : 0,
  };
}

export class PlanetScene {
  constructor(game, level, cfg, opts = {}) {
    this.game = game;
    this.level = level;
    this.cfg = cfg;
    this.world = new World(level);
    this.t = 0;
    this.tw = new Tweens();
    this.fx = opts.fx || new Particles();
    this.rx = this.world.rocketX;
    this.ry = this.world.groundAt(this.rx);
    this.camX = 0;
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.hatch = { v: 0 };
    this.hero = { x: this.rx + HATCH.x, y: this.ry + HATCH.y, s: 0.4, dir: 1, phase: 0, target: null, state: 'intro', vx: 0, dizzy: 0, invuln: 0, jump: 0, carry: [], visible: true };
    this.crew = [
      { x: this.rx - 120, color: CREW_COLORS[1], dir: 1, cheer: 0, visible: false },
      { x: this.rx - 190, color: CREW_COLORS[2], dir: 1, cheer: 0, visible: false },
    ];
    this.delivered = [];
    this.timer = 0;
    this.idle = 0;
    this.state = 'intro';
    this.tapMark = null;
    this.generate();
    this.startIntro();
    this.onResize();
  }

  onResize() { layoutTopRight([this.sound, this.home]); }
  enter() { playMusic('planet'); }

  generate() {
    const r = rng(this.world.seed + 77);
    const spec = levelSpec(this.level);
    const W = this.world.width;
    this.treasures = [];
    this.hiders = [];
    // Spread treasures through sections to the right (and a bit left) of the rocket.
    const lo = this.rx + 280, hi = W - 120;
    const n = spec.treasures;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const a = lo + ((hi - lo) * i) / n, b = lo + ((hi - lo) * (i + 1)) / n;
      xs.push(r.range(a + 30, b - 30));
    }
    // Occasionally put one on the left side of the rocket.
    if (this.level >= 4 && this.rx > 420) xs[r.int(0, n - 1)] = r.range(90, this.rx - 260);
    const hiddenIdx = new Set();
    while (hiddenIdx.size < Math.min(spec.hidden, n)) hiddenIdx.add(r.int(0, n - 1));
    xs.forEach((x, i) => {
      const tr = { type: TREASURES[r.int(0, TREASURES.length - 1)], hue: r.int(0, 4), x, y: this.world.groundAt(x) - 26, vx: 0, vy: 0, state: 'ground', bob: r() * TAU };
      if (hiddenIdx.has(i)) {
        const type = r.pick(['rock', 'bush', 'qblock']);
        const h = { type, x, y: type === 'qblock' ? this.world.groundAt(x) - QBLOCK_H : this.world.groundAt(x) + 4, treasure: tr, used: false, shake: 0, rot: 0, bump: 0 };
        tr.state = 'hidden';
        this.hiders.push(h);
      }
      this.treasures.push(tr);
    });
    // Bugs: they only push and annoy, they never hurt.
    this.bugs = [];
    const bugX = () => r.range(this.rx + 450, W - 150);
    for (let i = 0; i < spec.beetles; i++) {
      const x = bugX();
      this.bugs.push({ kind: 'beetle', x, y: 0, dir: r() < 0.5 ? -1 : 1, speed: 60 + this.level * 3, min: x - r.range(150, 300), max: x + r.range(150, 300), gone: 0, color: r.pick(['#e8443a', '#5cc95a', '#3b8fe8', '#f5962a']), hitCool: 0 });
    }
    for (let i = 0; i < spec.flies; i++) {
      const x = bugX();
      this.bugs.push({ kind: 'fly', x, ax: x, y: 0, dir: 1, ph: r() * TAU, gone: 0, color: r.pick(['#7bd36b', '#c78bff', '#ffb347']), hitCool: 0 });
    }
    this.bugs.forEach((b) => this.placeBugY(b));
    // Par time for 3 stars: walk to the farthest treasure and back, plus some time per task.
    const far = Math.max(...this.treasures.map((tr) => Math.abs(tr.x - this.rx)));
    this.par = (far * 2.4) / SPEED + n * 2.5 + spec.hidden * 2.5 + (spec.beetles + spec.flies) * 3 + 3;
  }

  placeBugY(b) {
    if (b.kind === 'beetle') b.y = this.world.groundAt(b.x);
    else b.y = this.world.groundAt(b.x) - 80 + Math.sin(this.t * 3 + b.ph) * 22;
  }

  startIntro() {
    const h = this.hero;
    this.tw.add(this.hatch, { v: 1 }, 0.3, {
      onDone: () => {
        sfx('jump');
        h.state = 'introJump';
        this.tw.add(h, { x: this.rx + 110, y: this.world.groundAt(this.rx + 110), s: 1 }, 0.55, {
          arc: 120, ease: ease.inOutQuad,
          onDone: () => {
            h.state = 'idle';
            this.fx.dust(h.x, h.y, 6);
            this.crew.forEach((c, i) => setTimeout(() => { c.visible = true; c.cheer = 1.5; this.fx.dust(c.x, this.world.groundAt(c.x), 4); sfx('pop'); }, 150 + i * 200));
            this.tw.add(this.hatch, { v: 0 }, 0.3, { delay: 0.6 });
            this.state = 'play';
          },
        });
      },
    });
  }

  // ---------- input ----------
  onDown(p) {
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new MapScene(this.game)); return; }
    if (this.state === 'results') { this.resultsTap(p); return; }
    if (this.state !== 'play') return;
    this.idle = 0;
    const wx = p.x + this.camX, wy = p.y;
    // Swat a bug
    for (const b of this.bugs) {
      if (b.gone > 0) continue;
      const by = b.kind === 'beetle' ? b.y - 24 : b.y;
      if (dist(wx, wy, b.x, by) < 75) { this.swat(b); return; }
    }
    // Tap a rock / bush / ?-block: walk there and open it.
    for (const h of this.hiders) {
      if (h.used) continue;
      const hy = h.type === 'qblock' ? h.y : h.y - 40;
      if (Math.abs(wx - h.x) < 80 && Math.abs(wy - hy) < 90) {
        this.walkTo(h.x, h);
        return;
      }
    }
    this.holding = true;
    this.walkTo(wx, null);
  }
  onMove(p) {
    if (!this.holding || this.state !== 'play') return;
    this.hero.target = clamp(p.x + this.camX, 60, this.world.width - 60);
    this.hero.pending = null;
  }
  onUp() { this.holding = false; }

  walkTo(x, hider) {
    const h = this.hero;
    h.target = clamp(x, 60, this.world.width - 60);
    h.pending = hider;
    this.tapMark = { x: h.target, t: 0.5 };
    sfx('tap');
  }

  swat(b) {
    b.gone = 9;
    b.fallX = b.x; b.fallY = b.kind === 'beetle' ? b.y - 24 : b.y; b.fallVy = -500; b.spin = 0;
    sfx('swat');
    for (let i = 0; i < 6; i++) this.fx.star(b.x, b.fallY, { sp: 220 });
  }

  // ---------- hiders ----------
  openHider(h) {
    if (h.used) return;
    h.used = true;
    const tr = h.treasure;
    const pop = (x, y) => {
      tr.state = 'pop'; tr.x = x; tr.y = y; tr.vy = -620; tr.vx = (this.hero.x < h.x ? 1 : -1) * 40; tr.age = 0;
      sfx('coin');
      this.fx.burst(x, y, 10);
    };
    if (h.type === 'rock') {
      sfx('rock');
      const dir = this.hero.x < h.x ? 1 : -1;
      this.tw.add(h, { x: h.x + dir * 120, rot: dir * TAU * 0.6 }, 0.7, { ease: ease.outQuad, onDone: () => { h.y = this.world.groundAt(h.x) + 4; } });
      this.fx.dust(h.x, this.world.groundAt(h.x), 10);
      setTimeout(() => pop(h.x, this.world.groundAt(h.x) - 30), 200);
    } else if (h.type === 'bush') {
      sfx('rustle');
      h.shake = 1;
      this.tw.add(h, { shake: 0 }, 0.5, { onDone: () => pop(h.x, h.y - 50) });
    } else if (h.type === 'qblock') {
      const hero = this.hero;
      hero.state = 'jump'; hero.jump = 0;
      sfx('jump');
      setTimeout(() => {
        sfx('bump');
        h.bump = 1;
        this.tw.add(h, { bump: 0 }, 0.25);
        pop(h.x, h.y - 40);
      }, 200);
    }
  }

  // ---------- update ----------
  update(dt) {
    this.t += dt;
    this.tw.update(dt);
    this.fx.update(dt);
    if (this.tapMark) { this.tapMark.t -= dt; if (this.tapMark.t <= 0) this.tapMark = null; }
    if (this.state === 'play') { this.timer += dt; this.idle += dt; }
    this.updateHero(dt);
    this.updateTreasures(dt);
    this.updateBugs(dt);
    for (const c of this.crew) c.cheer = Math.max(0, c.cheer - dt);
    // camera
    const target = clamp(this.hero.x - V.w * 0.45, 0, Math.max(0, this.world.width - V.w));
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
    if (this.state === 'results') this.updateResults(dt);
  }

  updateHero(dt) {
    const h = this.hero, w = this.world;
    if (h.state === 'intro' || h.state === 'introJump' || h.state === 'boarding') return;
    h.invuln = Math.max(0, h.invuln - dt);
    if (h.dizzy > 0) {
      h.dizzy -= dt;
      h.x = clamp(h.x + h.vx * dt, 60, w.width - 60);
      h.vx *= Math.exp(-5 * dt);
      h.hop = Math.max(0, (h.hop || 0) - dt);
      h.y = w.groundAt(h.x) - Math.sin(Math.min(1, h.hop / 0.35) * Math.PI) * 40;
      h.walking = false;
      if (h.dizzy <= 0) { h.state = 'idle'; h.target = null; }
      return;
    }
    if (h.state === 'jump') {
      h.jump += dt;
      const k = Math.min(1, h.jump / 0.45);
      h.y = w.groundAt(h.x) - Math.sin(k * Math.PI) * 70;
      h.walking = false;
      if (k >= 1) { h.state = 'idle'; h.y = w.groundAt(h.x); }
      return;
    }
    h.walking = false;
    if (h.target !== null && this.state === 'play') {
      const dx = h.target - h.x;
      if (Math.abs(dx) < 6) {
        h.target = null;
        if (h.pending && Math.abs(h.pending.x - h.x) < 40) this.openHider(h.pending);
        h.pending = null;
      } else {
        h.dir = Math.sign(dx);
        h.x += h.dir * Math.min(SPEED * dt, Math.abs(dx));
        h.phase += dt * 15;
        h.walking = true;
      }
    }
    h.y = w.groundAt(h.x);
    // Deliver treasures at the rocket.
    if (this.state === 'play' && h.carry.length && Math.abs(h.x - this.rx) < 110) this.deliver();
  }

  updateTreasures(dt) {
    const h = this.hero, w = this.world;
    h.carry.forEach((tr, i) => {
      tr.x = h.x + Math.sin(this.t * 6 + i) * 4 * (h.walking ? 1 : 0.3);
      tr.y = h.y - 150 - i * 40;
    });
    for (const tr of this.treasures) {
      if (tr.state === 'pop') {
        tr.age += dt;
        tr.vy += 1500 * dt;
        tr.x += tr.vx * dt; tr.y += tr.vy * dt;
        // Bounce off the world edges so a treasure never lands where the astronaut can't walk.
        const lo = 100, hi = w.width - 100;
        if (tr.x < lo) { tr.x = lo; tr.vx = Math.abs(tr.vx); }
        if (tr.x > hi) { tr.x = hi; tr.vx = -Math.abs(tr.vx); }
        const gy = w.groundAt(tr.x) - 26;
        if (tr.vy > 0 && tr.y >= gy) {
          tr.y = gy;
          if (tr.vy > 300) { tr.vy = -tr.vy * 0.35; tr.vx *= 0.5; } else { tr.state = 'ground'; tr.vy = 0; }
        }
      } else if (tr.state === 'ground') {
        tr.x = clamp(tr.x, 100, w.width - 100);
        tr.y =w.groundAt(tr.x) - 26 + Math.sin(this.t * 3 + tr.bob) * 5;
        if (this.state === 'play' && h.dizzy <= 0 && Math.abs(h.x - tr.x) < 50 && h.state !== 'intro') {
          tr.state = 'carried';
          h.carry.push(tr);
          sfx('coin');
          this.fx.burst(tr.x, tr.y, 8);
          this.idle = 0;
        }
      }
    }
  }

  updateBugs(dt) {
    const h = this.hero, w = this.world;
    for (const b of this.bugs) {
      b.hitCool = Math.max(0, b.hitCool - dt);
      if (b.gone > 0) {
        b.gone -= dt;
        b.fallVy += 1200 * dt; b.fallY += b.fallVy * dt; b.spin += dt * 12;
        if (b.gone <= 0) {
          // Come back somewhere away from the astronaut.
          let x;
          for (let k = 0; k < 10; k++) { x = R.range(this.rx + 400, w.width - 120); if (Math.abs(x - h.x) > 500) break; }
          b.x = x; b.ax = x; b.min = x - 220; b.max = x + 220;
          this.placeBugY(b);
          this.fx.dust(b.x, b.y, 6);
        }
        continue;
      }
      if (b.kind === 'beetle') {
        b.x += b.dir * b.speed * dt;
        if (b.x < b.min) { b.x = b.min; b.dir = 1; }
        if (b.x > b.max) { b.x = b.max; b.dir = -1; }
        b.x = clamp(b.x, this.rx + 250, w.width - 40);
      } else {
        // Flies drift slowly towards the astronaut when close.
        if (Math.abs(h.x - b.ax) < 420 && this.state === 'play') b.ax += Math.sign(h.x - b.ax) * 55 * dt;
        b.ax = clamp(b.ax, this.rx + 260, w.width - 80);
        const nx = b.ax + Math.sin(this.t * 0.9 + b.ph) * 110;
        b.dir = nx > b.x ? 1 : -1;
        b.x = nx;
      }
      this.placeBugY(b);
      // Bump into the astronaut
      if (this.state !== 'play' || h.invuln > 0 || h.dizzy > 0 || b.hitCool > 0 || h.state === 'jump') continue;
      const hit = b.kind === 'beetle'
        ? Math.abs(b.x - h.x) < 48
        : dist(b.x, b.y, h.x, h.y - 60) < 55;
      if (hit) this.bugHit(b);
    }
  }

  bugHit(b) {
    const h = this.hero;
    const away = h.x < b.x ? -1 : 1;
    h.dizzy = 0.9; h.vx = away * 480; h.hop = 0.35; h.invuln = 2.6; h.target = null; h.pending = null;
    b.hitCool = 1.5;
    if (b.kind === 'beetle') b.dir = -away;
    else b.ax -= away * 160;
    sfx('hit'); sfx('buzz');
    for (let i = 0; i < 5; i++) this.fx.star(h.x, h.y - 100, { sp: 160, r: 8 });
    // Drop the top treasure; it bounces away and has to be picked up again.
    if (h.carry.length) {
      const tr = h.carry.pop();
      tr.state = 'pop'; tr.vx = away * 260; tr.vy = -520; tr.age = 0;
    }
  }

  deliver() {
    const h = this.hero;
    const items = h.carry.splice(0);
    items.forEach((tr, i) => {
      tr.state = 'deliver';
      this.tw.add(tr, { x: this.rx, y: this.ry - 176 }, 0.4, {
        delay: i * 0.15, arc: 80, ease: ease.inOutQuad,
        onDone: () => {
          tr.state = 'done';
          this.delivered.push(tr);
          sfx('deliver');
          this.fx.burst(this.rx, this.ry - 176, 10);
          this.crew.forEach((c) => (c.cheer = 1.2));
          this.hudPulse = 0.5;
          if (this.delivered.length === this.treasures.length) this.complete();
        },
      });
    });
  }

  complete() {
    if (this.state !== 'play') return;
    this.state = 'boarding';
    this.time = this.timer;
    this.stars = this.time <= this.par * 1.2 ? 3 : this.time <= this.par * 2 ? 2 : 1;
    recordLevel(this.level, this.stars, Math.round(this.time));
    sfx('fanfare');
    this.fx.confetti(this.rx, this.ry - 300, 70);
    const h = this.hero;
    h.target = null;
    this.tw.add(this.hatch, { v: 1 }, 0.3, { delay: 0.6 });
    // Everyone climbs back in.
    setTimeout(() => {
      [h, ...this.crew].forEach((c, i) => {
        setTimeout(() => {
          if (c === h) h.state = 'boarding';
          c.s = 1; c.y = this.world.groundAt(c.x);
          this.tw.add(c, { x: this.rx, y: this.ry + HATCH.y + 50, s: 0.35 }, 0.5, { arc: 100, ease: ease.inOutQuad, onDone: () => { c.visible = false; sfx('pop'); } });
          sfx('jump');
        }, i * 300);
      });
    }, 900);
    setTimeout(() => { this.tw.add(this.hatch, { v: 0 }, 0.3); this.showResults(); }, 2400);
  }

  // ---------- results ----------
  showResults() {
    this.state = 'results';
    this.res = { t: 0, shown: 0 };
    const last = this.level >= LEVELS;
    this.nextBtn = new Button(last ? 'star' : 'next', '#5cc95a', 64);
    this.retryBtn = new Button('retry', '#3b8fe8', 44);
    this.mapBtn = new Button('home', '#f5962a', 44);
    this.nextBtn.visible = this.retryBtn.visible = this.mapBtn.visible = false;
  }
  updateResults(dt) {
    const r = this.res;
    r.t += dt;
    const cx = V.w / 2;
    this.nextBtn.x = cx; this.nextBtn.y = 560;
    this.retryBtn.x = cx - 170; this.retryBtn.y = 570;
    this.mapBtn.x = cx + 170; this.mapBtn.y = 570;
    while (r.shown < 3 && r.t > 0.6 + r.shown * 0.5) {
      const i = r.shown++;
      if (i < this.stars) {
        sfx('star', i);
        this.fx.burst(cx + (i - 1) * 140, 330, 14);
      }
    }
    if (r.t > 2.2 && !this.nextBtn.visible) {
      this.nextBtn.visible = this.retryBtn.visible = this.mapBtn.visible = true;
      this.nextBtn.pulse = true;
    }
  }
  resultsTap(p) {
    if (this.nextBtn.hit(p)) {
      sfx('pop');
      if (this.level >= LEVELS) this.game.go(new FinaleScene(this.game));
      else this.game.go(new BuildScene(this.game, this.level + 1));
    } else if (this.retryBtn.hit(p)) {
      sfx('pop');
      this.game.go(new BuildScene(this.game, this.level));
    } else if (this.mapBtn.hit(p)) {
      sfx('pop');
      this.game.go(new MapScene(this.game));
    }
  }

  // ---------- draw ----------
  draw(ctx) {
    const t = this.t, w = this.world, cx = this.camX;
    w.drawBackground(ctx, cx, 0, t);
    ctx.save();
    ctx.translate(-cx, 0);
    if (this.tapMark) {
      const k = this.tapMark.t / 0.5;
      ctx.globalAlpha = k;
      ctx.beginPath(); ctx.ellipse(this.tapMark.x, w.groundAt(this.tapMark.x) + 4, 40 * (1.4 - k), 12 * (1.4 - k), 0, 0, TAU);
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawRocket(ctx, this.rx, this.ry, this.cfg, { crew: this.state !== 'play', hatch: this.hatch.v > 0.01 ? this.hatch.v : 0 });
    if (this.state === 'play' && this.allFound()) {
      // Rocket glows when everything has been found.
      ctx.globalAlpha = 0.3 + Math.sin(t * 6) * 0.2;
      circle(ctx, this.rx, this.ry - 180, 200); ctx.fillStyle = 'rgba(255,240,120,0.35)'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const c of this.crew) {
      if (!c.visible) continue;
      drawAstronaut(ctx, c.x, c.y ?? w.groundAt(c.x), { t: t + c.x, color: c.color, arms: c.cheer > 0 ? 'up' : null, dir: 1, scale: c.s || 1 });
    }
    for (const h of this.hiders) {
      const hh = h.bump ? { ...h, y: h.y - Math.sin(h.bump * Math.PI) * 18 } : h;
      if (h.type === 'qblock') {
        ctx.beginPath(); ctx.ellipse(h.x, w.groundAt(h.x) + 2, 34, 8, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
      }
      drawHider(ctx, hh, t, w.theme);
    }
    for (const tr of this.treasures) {
      if (tr.state === 'ground' || tr.state === 'pop' || tr.state === 'deliver') drawTreasure(ctx, tr.type, tr.x, tr.y, t, 1, tr.hue);
    }
    for (const b of this.bugs) {
      if (b.gone > 0) {
        ctx.save(); ctx.translate(b.fallX, b.fallY); ctx.rotate(b.spin); ctx.scale(1, -1);
        if (b.kind === 'beetle') drawBeetle(ctx, 0, 24, 1, t, b.color); else drawFly(ctx, 0, 0, 1, t, b.color);
        ctx.restore();
        continue;
      }
      if (b.kind === 'beetle') drawBeetle(ctx, b.x, b.y, b.dir, t, b.color);
      else drawFly(ctx, b.x, b.y, b.dir, t, b.color);
    }
    const h = this.hero;
    if (h.visible !== false && !(h.invuln > 0 && h.dizzy <= 0 && Math.floor(t * 12) % 2)) {
      drawAstronaut(ctx, h.x, h.y, { t, dir: h.dir, walking: h.walking, phase: h.phase, color: CREW_COLORS[0], carrying: h.carry.length > 0, dizzy: h.dizzy > 0, scale: h.s });
    }
    for (const tr of h.carry) drawTreasure(ctx, tr.type, tr.x, tr.y, t, 0.85, tr.hue);
    this.fx.draw(ctx);
    ctx.restore();

    this.drawPointer(ctx);
    this.drawHud(ctx);
    if (this.state === 'results') this.drawResults(ctx);
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }

  allFound() {
    return this.treasures.every((tr) => tr.state === 'carried' || tr.state === 'deliver' || tr.state === 'done');
  }

  // Arrow towards the rocket when all treasures are found, or a hint arrow when idle.
  drawPointer(ctx) {
    if (this.state !== 'play') return;
    let tx = null, ty = null;
    if (this.allFound() && this.hero.carry.length) { tx = this.rx; ty = this.ry - 200; }
    else if (this.idle > 6) {
      let best = null, bd = 1e9;
      for (const tr of this.treasures) {
        if (tr.state !== 'ground' && tr.state !== 'hidden') continue;
        const hider = tr.state === 'hidden' ? this.hiders.find((h) => h.treasure === tr) : null;
        const x = hider ? hider.x : tr.x, y = hider ? (hider.type === 'qblock' ? hider.y : hider.y - 50) : tr.y;
        const d = Math.abs(x - this.hero.x);
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) { tx = best.x; ty = best.y; }
    }
    if (tx === null) return;
    const sx = tx - this.camX;
    const b = Math.abs(Math.sin(this.t * 5)) * 14;
    if (sx < 40) drawArrow(ctx, V.safeL + 70 + b * -1, Math.min(ty, 560), Math.PI, 1.1);
    else if (sx > V.w - 40) drawArrow(ctx, V.w - V.safeR - 70 + b, Math.min(ty, 560), 0, 1.1);
    else drawArrow(ctx, sx, ty - 90 - b, Math.PI / 2, 1);
  }

  drawHud(ctx) {
    const n = this.treasures.length;
    const x0 = V.safeL + 40, y0 = V.safeT + 30;
    rr(ctx, x0 - 14, y0 - 6, n * 62 + 16, 72, 30); ctx.fillStyle = 'rgba(20,14,40,0.35)'; ctx.fill();
    for (let i = 0; i < n; i++) {
      const x = x0 + 30 + i * 62, y = y0 + 30;
      circle(ctx, x, y, 26); fs(ctx, 'rgba(255,255,255,0.25)', 3);
      const tr = this.delivered[i];
      if (tr) {
        const pop = i === this.delivered.length - 1 && this.hudPulse > 0 ? 1 + this.hudPulse * 0.6 : 1;
        drawTreasure(ctx, tr.type, x, y, this.t, 0.7 * pop, tr.hue);
      }
    }
    this.hudPulse = Math.max(0, (this.hudPulse || 0) - 0.016);
  }

  drawResults(ctx) {
    const r = this.res, cx = V.w / 2;
    ctx.fillStyle = `rgba(20,14,40,${Math.min(0.55, r.t)})`;
    ctx.fillRect(0, 0, V.w, V.h);
    const s = ease.outBack(Math.min(1, r.t * 2.5));
    ctx.save();
    ctx.translate(cx, 380); ctx.scale(s, s);
    rr(ctx, -300, -220, 600, 430, 40); fs(ctx, '#fff8e8', 6);
    rr(ctx, -300, -220, 600, 70, 40); ctx.fillStyle = '#ffcc1a'; ctx.fill();
    rr(ctx, -300, -220, 600, 430, 40); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    // The treasures that were collected
    const n = this.delivered.length;
    this.delivered.forEach((tr, i) => drawTreasure(ctx, tr.type, (i - (n - 1) / 2) * 62, -185, this.t, 0.75, tr.hue));
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const shown = r.shown > i;
      const k = shown ? ease.outElastic(Math.min(1, (r.t - 0.6 - i * 0.5) * 2)) : 0;
      const x = cx + (i - 1) * 140, y = 330 - (i === 1 ? 20 : 0);
      drawStarIcon(ctx, x, y, 56 * s, false);
      if (shown && i < this.stars) {
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate((1 - k) * 2);
        drawStarIcon(ctx, 0, 0, 56, true);
        ctx.restore();
      }
    }
    this.retryBtn.draw(ctx, this.t);
    this.mapBtn.draw(ctx, this.t);
    this.nextBtn.draw(ctx, this.t);
    if (this.nextBtn.visible && r.t > 6) drawHand(ctx, this.nextBtn.x + 20, this.nextBtn.y + 20, 1, Math.sin(this.t * 6) > 0 ? 1 : 0);
  }
}
