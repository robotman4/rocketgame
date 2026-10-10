// Treasure hunt on a planet. Tap to walk, collect treasures, bring them back to the rocket.
import { V, R, rng, clamp, dist, ease, Tweens, TAU } from '../core.js';
import { World } from '../world.js';
import { drawRocket, drawPartAt, spareFor, SLOT_BOX, HATCH } from '../rocket.js';
import { drawAstronaut, drawBeetle, drawFly, drawTreasure, drawHider, drawArrow, drawHand, TREASURES, circle, ellipse, fs, INK, rr, drawAlien, drawHat, HATS } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { sfx, playMusic, toggleMute } from '../audio.js';
import { Particles } from '../particles.js';
import { recordLevel, LEVELS, hasSpare, addSpare, isDanger, DANGER_FROM, save, persist, hatsUnlocked } from '../storage.js';
import { CREW_COLORS } from './flight.js';
import { BuildScene } from './build.js';
import { MapScene } from './map.js';
import { FinaleScene } from './finale.js';

const SPEED = 300;
const QBLOCK_H = 205;
// Where bugs sit when they take over the rocket (rocket-local coordinates).
const SQUAT_SPOTS = [
  { x: 0, y: -350, rot: 0, kind: 'beetle' },
  { x: -60, y: -190, rot: -Math.PI / 2, kind: 'beetle' },
  { x: 60, y: -120, rot: Math.PI / 2, kind: 'beetle' },
  { x: -120, y: -260, rot: 0, kind: 'fly' },
  { x: 125, y: -300, rot: 0, kind: 'fly' },
];

// How a level is put together. Gets a bit bigger and busier every planet.
export function levelSpec(level) {
  if (isDanger(level)) {
    const d = level - DANGER_FROM; // 0..9
    return {
      treasures: 4 + Math.floor(d / 3),
      hidden: 2 + Math.floor(d / 3),
      beetles: 2 + Math.floor(d / 4),
      flies: 1 + Math.floor(d / 4),
      squatters: Math.min(5, 3 + Math.floor(d / 4)),
      thief: true,
      hearts: 2,
    };
  }
  return {
    treasures: 3 + Math.floor((level - 1) / 4),
    hidden: Math.min(2 + Math.floor((level - 1) / 4), Math.floor(level / 2.5)),
    beetles: level >= 3 ? 1 + Math.floor((level - 3) / 8) : 0,
    flies: level >= 6 ? 1 + Math.floor((level - 6) / 8) : 0,
    squatters: level >= 2 ? Math.min(5, 2 + Math.floor((level - 2) / 5)) : 0,
    thief: level >= 5,
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
    this.danger = isDanger(level);
    this.hearts = this.danger ? 2 : 0;
    this.heartShake = 0;
    this.hurtFlash = 0;
    this.warn = this.danger ? 3 : 0;
    this.timer = 0;
    this.idle = 0;
    this.state = 'intro';
    this.tapMark = null;
    this.generate();
    this.startIntro();
    this.onResize();
  }

  onResize() { layoutTopRight([this.sound, this.home]); }
  enter() {
    playMusic(this.danger ? 'danger' : 'planet');
    if (this.danger) sfx('alarm');
  }

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
    if (this.level >= 4 && this.rx > 420) xs[r.int(0, n - 1)] = r.range(this.minX() + 10, this.rx - 260);
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
      this.bugs.push({ kind: 'beetle', x, y: 0, dir: r() < 0.5 ? -1 : 1, speed: (60 + Math.min(this.level, 20) * 3) * (this.danger ? 1.25 : 1), min: x - r.range(150, 300), max: x + r.range(150, 300), gone: 0, color: this.danger ? r.pick(['#8b1a2b', '#5a1a6b', '#2f2f45']) : r.pick(['#e8443a', '#5cc95a', '#3b8fe8', '#f5962a']), hitCool: 0 });
    }
    for (let i = 0; i < spec.flies; i++) {
      const x = bugX();
      this.bugs.push({ kind: 'fly', x, ax: x, y: 0, dir: 1, ph: r() * TAU, gone: 0, color: this.danger ? r.pick(['#c0392b', '#7a1f5c']) : r.pick(['#7bd36b', '#c78bff', '#ffb347']), hitCool: 0 });
    }
    this.bugs.forEach((b) => this.placeBugY(b));
    // A thief bug that grabs a carried treasure and tries to hide it again.
    this.thief = spec.thief ? { state: 'off', cool: r.range(8, 12), x: 0, y: 0, dir: 1, item: null, speed: this.level >= 10 ? 165 : 135, spin: 0 } : null;
    // Alien buddy: found once (from planet 3), then comes along on every planet
    // unless it was sent back to the rocket.
    this.buddy = null; this.lostAlien = null;
    if (save.buddy) {
      const home = save.buddyOn === false;
      this.buddy = { x: this.rx + (home ? -70 : 60), y: 0, dir: 1, state: home ? 'home' : 'follow', visible: false, happy: 0, dizzy: 0, sneeze: 0, nextSneeze: r.range(12, 22), squash: 0, walking: false };
    } else if (this.level >= 3) {
      const ax = clamp(this.rx + 650, this.minX() + 50, W - 200);
      this.lostAlien = { x: ax, found: false };
    }
    // A sleepy beetle that snores. Harmless; tap it and it jumps awake, then dozes off again.
    this.sleeper = this.level >= 2 ? { x: r.range(this.rx + 350, W - 200), awake: 0, nextSnore: 0 } : null;
    // One spare part per planet, until it has been found.
    this.spare = null;
    if (!hasSpare(this.level)) {
      const sp = spareFor(this.level);
      let x = 0;
      for (let k = 0; k < 30; k++) {
        x = r.range(Math.max(this.rx + 400, W * 0.5), W - 150);
        if (this.treasures.every((tr) => Math.abs(tr.x - x) > 160)) break;
      }
      const o = { ...sp, isSpare: true, x, y: 0, vx: 0, vy: 0, state: 'ground', bob: r() * TAU };
      o.y = this.restY(o);
      if (this.level >= 3 && r() < 0.5) {
        const type = r.pick(['rock', 'bush']);
        this.hiders.push({ type, x, y: this.world.groundAt(x) + 4, treasure: o, used: false, shake: 0, rot: 0, bump: 0 });
        o.state = 'hidden';
      }
      this.spare = o;
    }
    // Bugs that sneak onto the rocket while the astronaut is away.
    this.squatters = SQUAT_SPOTS.slice(0, spec.squatters).map((sp, i) => ({
      ...sp, state: 'wait', ox: 0, oy: 0, k: 0, delay: i * 0.35, ph: r() * TAU,
      color: this.danger ? r.pick(['#8b1a2b', '#5a1a6b', '#2f2f45']) : r.pick(['#e8443a', '#5cc95a', '#3b8fe8', '#f5962a', '#c78bff']),
    }));
    // Par time for 3 stars: walk to the farthest treasure and back, plus some time per task.
    const far = Math.max(...this.treasures.map((tr) => Math.abs(tr.x - this.rx)));
    this.par = (far * 2.4) / SPEED + n * 2.5 + spec.hidden * 2.5 + (spec.beetles + spec.flies) * 3 + spec.squatters * 1.5 + (spec.thief ? 4 : 0) + 3;
  }

  // Items stay within this range so they are always visible and reachable,
  // also next to the iPhone notch and rounded corners.
  minX() { return 100 + V.safeL; }
  maxX() { return this.world.width - 100 - V.safeR; }

  // Height above the ground where an item rests.
  restY(o) {
    const off = o.isSpare ? (SLOT_BOX[o.slot].h / 2) * 0.42 + 6 : 26;
    return this.world.groundAt(o.x) - off;
  }

  // Shared "popped out / knocked off" physics for treasures and spare parts.
  stepPop(o, dt) {
    const w = this.world;
    o.age += dt;
    o.vy += 1500 * dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
    // Bounce off the world edges so nothing lands where the astronaut can't walk.
    const lo = this.minX(), hi = this.maxX();
    if (o.x < lo) { o.x = lo; o.vx = Math.abs(o.vx); }
    if (o.x > hi) { o.x = hi; o.vx = -Math.abs(o.vx); }
    const gy = this.restY(o);
    if (o.vy > 0 && o.y >= gy) {
      o.y = gy;
      if (o.vy > 300) { o.vy = -o.vy * 0.35; o.vx *= 0.5; } else { o.state = 'ground'; o.vy = 0; }
    }
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
            if (this.buddy) setTimeout(() => { this.buddy.visible = true; this.buddy.happy = 1; this.fx.dust(this.buddy.x, this.world.groundAt(this.buddy.x), 5); sfx('yay'); }, 650);
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
    if (this.state !== 'play' && this.state !== 'clear') return;
    if (this.warn > 1) return; // let the warning be seen first
    this.idle = 0;
    const wx = p.x + this.camX, wy = p.y;
    // Tap the thief to make it drop what it took
    const th = this.thief;
    if (th && (th.state === 'flee' || th.state === 'swoop') && dist(wx, wy, th.x, th.y) < 85) {
      if (th.state === 'flee') this.thiefCaught(); else { sfx('swat'); this.thiefLeave(true); }
      return;
    }
    // Flick a bug off the rocket
    for (const q of this.squatters) {
      if (q.state !== 'sit' && q.state !== 'arrive') continue;
      const c = this.squatterPos(q);
      if (dist(wx, wy, c.x, c.y) < 70) { this.flickSquatter(q); return; }
    }
    if (this.state === 'clear') return;
    // Swat a bug
    for (const b of this.bugs) {
      if (b.gone > 0) continue;
      const by = b.kind === 'beetle' ? b.y - 24 : b.y;
      if (dist(wx, wy, b.x, by) < 75) { this.swat(b); return; }
    }
    // Alien buddy: tap to send it back to the rocket, or to bring it along again.
    const bd = this.buddy;
    if (bd && bd.visible && dist(wx, wy, bd.x, bd.y - 30) < 60) { this.toggleBuddy(); return; }
    // Crew by the rocket: wave and hop.
    for (const c of this.crew) {
      if (c.visible && Math.abs(wx - c.x) < 45 && wy > this.world.groundAt(c.x) - 130 && wy < this.world.groundAt(c.x) + 10) {
        c.cheer = 1.5; c.hop = 0.5; sfx('jump'); return;
      }
    }
    // Sleepy beetle
    const sl = this.sleeper;
    if (sl && sl.awake <= 0 && dist(wx, wy, sl.x, this.world.groundAt(sl.x) - 24) < 70) {
      sl.awake = 2.5; sfx('bump'); this.fx.burst(sl.x, this.world.groundAt(sl.x) - 50, 6); return;
    }
    // Sky things react and use up the tap; hills and props react and the astronaut still walks.
    if (this.world.tap(p, this.camX, 0, this.t) === 'sky') return;
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
    this.hero.target = clamp(p.x + this.camX, this.minX() - 40, this.maxX() + 40);
    this.hero.pending = null;
  }
  onUp() { this.holding = false; }

  walkTo(x, hider) {
    const h = this.hero;
    h.target = clamp(x, this.minX() - 40, this.maxX() + 40);
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

  // ---------- bugs on the rocket ----------
  // World position of a squatter's body centre.
  squatterPos(q) {
    if (q.state === 'arrive' || q.state === 'flick') return { x: q.wx, y: q.wy };
    const wob = Math.sin(this.t * 4 + q.ph) * (q.kind === 'fly' ? 10 : 2);
    if (q.kind === 'fly') return { x: this.rx + q.x + wob, y: this.ry + q.y + Math.cos(this.t * 3 + q.ph) * 8 };
    // Beetle origin is its feet; body centre is 24 "up" in its own rotated frame.
    return { x: this.rx + q.x + Math.sin(q.rot) * 24, y: this.ry + q.y - Math.cos(q.rot) * 24 + wob };
  }

  squattersArrive() {
    this.squatArrived = true;
    for (const q of this.squatters) {
      q.state = 'arrive';
      const side = q.x < 0 ? -1 : 1;
      q.wx = this.rx + side * R.range(500, 800); q.wy = this.ry - R.range(300, 500);
      const target = { x: this.rx + q.x, y: this.ry + q.y + (q.kind === 'beetle' ? -24 : 0) };
      this.tw.add(q, { wx: target.x, wy: target.y }, 1.4, {
        delay: q.delay, arc: 60, ease: ease.inOutQuad,
        onDone: () => { if (q.state === 'arrive') q.state = 'sit'; },
      });
    }
  }

  flickSquatter(q) {
    const c = this.squatterPos(q);
    this.tw.cancel(q);
    q.state = 'flick'; q.wx = c.x; q.wy = c.y;
    q.vx = (c.x < this.rx ? -1 : 1) * R.range(250, 400); q.vy = -R.range(400, 600); q.spin = 0;
    sfx('swat');
    for (let i = 0; i < 6; i++) this.fx.star(c.x, c.y, { sp: 220 });
    if (this.state === 'clear' && !this.squattersLeft()) setTimeout(() => this.complete(), 500);
  }

  squattersLeft() { return this.squatters.some((q) => q.state === 'sit' || q.state === 'arrive'); }

  updateSquatters(dt) {
    if (!this.squatArrived && this.squatters.length && this.state === 'play') {
      // Only when the rocket is off screen, so it happens "while you were gone".
      const sx = this.rx - this.camX;
      if (sx < -200 || sx > V.w + 200) this.squattersArrive();
    }
    for (const q of this.squatters) {
      if (q.state !== 'flick') continue;
      q.vy += 1400 * dt; q.wx += q.vx * dt; q.wy += q.vy * dt; q.spin += dt * 14;
      if (q.wy > V.h + 200) q.state = 'gone';
    }
  }

  drawSquatters(ctx, t) {
    for (const q of this.squatters) {
      if (q.state === 'wait' || q.state === 'gone') continue;
      const c = this.squatterPos(q);
      ctx.save();
      ctx.translate(c.x, c.y);
      if (q.state === 'flick') ctx.rotate(q.spin);
      else if (q.state === 'sit' && q.kind === 'beetle') ctx.rotate(q.rot + Math.sin(t * 6 + q.ph) * 0.08);
      if (q.kind === 'beetle') drawBeetle(ctx, 0, 24, Math.sin(t * 0.7 + q.ph) > 0 ? 1 : -1, t, q.color);
      else drawFly(ctx, 0, 0, Math.sin(t * 0.7 + q.ph) > 0 ? 1 : -1, t, q.color);
      ctx.restore();
    }
  }

  // ---------- alien buddy ----------
  toggleBuddy() {
    const bd = this.buddy;
    if (bd.state === 'follow') {
      bd.state = 'run'; save.buddyOn = false; sfx('jump');
    } else {
      bd.state = 'follow'; save.buddyOn = true; bd.happy = 1; bd.squash = 1; sfx('yay');
      this.fx.burst(bd.x, bd.y - 40, 8);
    }
    persist();
  }

  updateBuddy(dt) {
    const bd = this.buddy, h = this.hero, w = this.world;
    // Finding the lost alien (first time only)
    const la = this.lostAlien;
    if (la && !la.found && this.state === 'play' && Math.abs(h.x - la.x) < 60) {
      la.found = true;
      save.buddy = true; save.buddyOn = true; persist();
      this.buddy = { x: la.x, y: w.groundAt(la.x), dir: -1, state: 'follow', visible: true, happy: 2, dizzy: 0, sneeze: 0, nextSneeze: 15, squash: 1, walking: false };
      sfx('yay'); sfx('ready');
      this.fx.confetti(la.x, w.groundAt(la.x) - 60, 40);
      this.fx.burst(la.x, w.groundAt(la.x) - 60, 12);
    }
    if (!bd) return;
    bd.happy = Math.max(0, bd.happy - dt); bd.dizzy = Math.max(0, bd.dizzy - dt);
    bd.squash = Math.max(0, bd.squash - dt * 3);
    bd.walking = false;
    if (bd.state === 'board') return;
    let target = null, speed = 340;
    if (bd.state === 'follow' && h.state !== 'boarding') target = h.x - h.dir * 75;
    if (bd.state === 'run') { target = this.rx - 75; speed = 420; }
    if (bd.state === 'home') target = this.rx - 75;
    if (target !== null && bd.dizzy <= 0) {
      const dx = target - bd.x;
      if (Math.abs(dx) > 8) { bd.dir = Math.sign(dx); bd.x += bd.dir * Math.min(speed * dt, Math.abs(dx)); bd.walking = true; }
      else if (bd.state === 'run') { bd.state = 'home'; bd.dir = 1; sfx('pop'); }
    }
    bd.y = w.groundAt(bd.x) - (bd.walking ? Math.abs(Math.sin(this.t * 14)) * 8 : 0) - (bd.happy > 0 ? Math.abs(Math.sin(bd.happy * 9)) * 22 : 0);
    // Sneezes now and then
    bd.nextSneeze -= dt;
    if (bd.nextSneeze <= 0 && bd.visible) {
      bd.nextSneeze = R.range(15, 28); bd.sneeze = 0.8; sfx('sneeze');
      setTimeout(() => { if (this.buddy === bd) { this.fx.smoke(bd.x + bd.dir * 25, bd.y - 20, { vx: bd.dir * 160, vy: -20, r: 8, grow: 30, life: 0.7 }); bd.x -= bd.dir * 12; } }, 350);
    }
    bd.sneeze = Math.max(0, bd.sneeze - dt);
  }

  drawBuddy(ctx, t) {
    const la = this.lostAlien, w = this.world;
    if (la && !la.found) {
      // Waiting on a rock, waving, until the astronaut walks up to it.
      const gy = w.groundAt(la.x);
      ctx.beginPath(); ctx.moveTo(la.x - 40, gy + 2); ctx.quadraticCurveTo(la.x - 40, gy - 34, la.x, gy - 36); ctx.quadraticCurveTo(la.x + 40, gy - 34, la.x + 40, gy + 2); ctx.closePath();
      fs(ctx, w.theme.rock || '#a59fb3');
      drawAlien(ctx, la.x, gy - 32 - Math.abs(Math.sin(t * 3)) * 6, { t, dir: -1, scale: 1 });
      if ((t % 2) < 1) { ctx.font = '900 34px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeText('?', la.x + 28, gy - 110); ctx.fillText('?', la.x + 28, gy - 110); }
    }
    const bd = this.buddy;
    if (!bd || !bd.visible) return;
    drawAlien(ctx, bd.x, bd.y, { t, dir: bd.dir, walking: bd.walking, happy: bd.happy > 0, dizzy: bd.dizzy > 0, sneeze: bd.sneeze > 0.4, squash: bd.squash, hat: save.hat });
    if (bd.state === 'home' && Math.abs(this.hero.x - bd.x) < 300 && (t % 3) < 0.6) {
      // waves at the astronaut: little hand
      circle(ctx, bd.x + 26, bd.y - 52 + Math.sin(t * 20) * 4, 7); fs(ctx, '#7bd36b', 3);
    }
  }

  // ---------- sleepy beetle ----------
  updateSleeper(dt) {
    const sl = this.sleeper;
    if (!sl) return;
    sl.awake = Math.max(0, sl.awake - dt);
    sl.nextSnore -= dt;
    const sx = sl.x - this.camX;
    if (sl.awake <= 0 && sl.nextSnore <= 0 && sx > 0 && sx < V.w && this.state === 'play') { sl.nextSnore = 3; sfx('snore'); }
  }

  drawSleeper(ctx, t) {
    const sl = this.sleeper;
    if (!sl) return;
    const gy = this.world.groundAt(sl.x);
    const jump = sl.awake > 2 ? Math.sin((2.5 - sl.awake) * 2 * Math.PI) * 40 : 0;
    ctx.save();
    if (sl.awake <= 0) {
      // asleep: squashed a little, eyes closed via a lid over the eye
      ctx.translate(sl.x, gy); ctx.scale(1.05, 0.92 + Math.sin(t * 2) * 0.03); ctx.translate(-sl.x, -gy);
    }
    drawBeetle(ctx, sl.x, gy - jump, -1, sl.awake > 0 ? t : 0, '#c78bff');
    ctx.restore();
    if (sl.awake <= 0) {
      ctx.beginPath(); ctx.arc(sl.x - 32, gy - 27, 6, 0, Math.PI); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.font = '900 26px Arial, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.textAlign = 'center';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k / 3) % 1;
        ctx.globalAlpha = 1 - ph; const zx = sl.x - 40 - ph * 30, zy = gy - 60 - ph * 70;
        ctx.font = `900 ${18 + ph * 16}px Arial, sans-serif`; ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy);
      }
      ctx.restore();
    } else if (sl.awake > 1.5) {
      ctx.save(); ctx.font = '900 40px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 6;
      ctx.strokeText('!', sl.x, gy - 90 - jump); ctx.fillText('!', sl.x, gy - 90 - jump); ctx.restore();
    }
  }

  // ---------- hiders ----------
  openHider(h) {
    if (h.used) return;
    h.used = true;
    const tr = h.treasure;
    const pop = (x, y) => {
      // Jump towards the astronaut, never towards the level edge.
      tr.state = 'pop'; tr.x = x; tr.y = y; tr.vy = -620; tr.vx = Math.sign(this.hero.x - x || 1) * 40; tr.age = 0;
      sfx('coin');
      this.fx.burst(x, y, 10);
    };
    if (h.type === 'rock') {
      sfx('rock');
      // Roll towards the middle of the level so it never ends up off screen, and land upright.
      const ox = h.x, dir = ox < this.world.width / 2 ? 1 : -1;
      this.tw.add(h, { x: ox + dir * 140, rot: dir * TAU }, 0.7, { ease: ease.outQuad, onDone: () => { h.y = this.world.groundAt(h.x) + 4; h.rot = 0; } });
      this.fx.dust(ox, this.world.groundAt(ox), 10);
      setTimeout(() => pop(ox, this.world.groundAt(ox) - 30), 200);
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
    if (this.state === 'play' || this.state === 'clear') { this.timer += dt; this.idle += dt; }
    this.warn = Math.max(0, this.warn - dt);
    this.heartShake = Math.max(0, this.heartShake - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.state === 'fail') this.failT += dt;
    this.updateHero(dt);
    this.updateTreasures(dt);
    this.updateSpare(dt);
    this.updateThief(dt);
    this.updateBuddy(dt);
    this.updateSleeper(dt);
    for (const c of this.crew) c.hop = Math.max(0, (c.hop || 0) - dt);
    this.updateBugs(dt);
    this.updateSquatters(dt);
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
      h.x = clamp(h.x + h.vx * dt, this.minX() - 40, this.maxX() + 40);
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
        this.stepPop(tr, dt);
      } else if (tr.state === 'ground') {
        tr.x = clamp(tr.x, this.minX(), this.maxX());
        tr.y =w.groundAt(tr.x) - 26 + Math.sin(this.t * 3 + tr.bob) * 5;
        if (this.state === 'play' && h.dizzy <= 0 && Math.abs(h.x - tr.x) < 50 && h.state !== 'intro') {
          tr.state = 'carried';
          h.carry.push(tr);
          sfx('coin');
          if (this.buddy && this.buddy.state === 'follow') this.buddy.happy = 0.8;
          this.fx.burst(tr.x, tr.y, 8);
          this.idle = 0;
        }
      }
    }
  }

  updateSpare(dt) {
    const o = this.spare, h = this.hero;
    if (!o) return;
    if (o.state === 'pop') this.stepPop(o, dt);
    else if (o.state === 'ground') {
      o.y = this.restY(o) + Math.sin(this.t * 3 + o.bob) * 5;
      if (this.state === 'play' && h.dizzy <= 0 && Math.abs(h.x - o.x) < 55) {
        o.state = 'fly';
        addSpare({ level: o.level, slot: o.slot, part: o.part });
        sfx('ready');
        this.fx.confetti(o.x, o.y, 30);
        this.idle = 0;
        // Fly up into the backpack slot in the corner.
        const hud = this.spareHudPos();
        this.tw.add(o, { x: hud.x + this.camX, y: hud.y }, 0.8, { arc: 120, ease: ease.inOutQuad, onDone: () => { o.state = 'got'; this.hudPulse = 0.5; } });
      }
    }
  }

  spareHudPos() {
    return { x: V.safeL + 40 + this.treasures.length * 62 + 44, y: V.safeT + 60 };
  }

  // ---------- thief ----------
  updateThief(dt) {
    const th = this.thief, h = this.hero, w = this.world;
    if (!th) return;
    if (th.state === 'off') {
      th.cool -= dt;
      if (th.cool <= 0 && this.state === 'play' && h.carry.length && Math.abs(h.x - this.rx) > 350 && h.dizzy <= 0) {
        // Swoop in from the far side, so it flees away from the rocket.
        const side = h.x >= this.rx ? 1 : -1;
        th.state = 'swoop'; th.x = h.x + side * V.w * 0.6; th.y = w.groundAt(h.x) - 320; th.dir = -side;
        sfx('buzz');
      }
      return;
    }
    if (th.state === 'swoop') {
      const tx = h.x, ty = h.y - 150 - Math.max(0, h.carry.length - 1) * 40;
      const d = dist(th.x, th.y, tx, ty);
      if (!h.carry.length || this.state !== 'play') { this.thiefLeave(false); return; }
      th.dir = tx > th.x ? 1 : -1;
      const sp = 430 * dt;
      if (d <= sp + 30) {
        th.item = h.carry.pop();
        th.item.state = 'stolen';
        th.state = 'flee'; th.fleeT = 0;
        th.dir = th.x >= h.x ? 1 : -1;
        sfx('whoosh');
      } else { th.x += ((tx - th.x) / d) * sp; th.y += ((ty - th.y) / d) * sp; }
      return;
    }
    if (th.state === 'flee') {
      th.fleeT += dt;
      // Fly away from the astronaut, low enough to be caught.
      const away = th.x >= h.x ? 1 : -1;
      th.dir = away;
      th.x = clamp(th.x + away * th.speed * dt, this.minX(), this.maxX());
      const gy = w.groundAt(th.x) - 95 + Math.sin(this.t * 5) * 10;
      th.y += (gy - th.y) * Math.min(1, dt * 4);
      th.item.x = th.x; th.item.y = th.y + 38;
      // Walking into it also makes it drop the treasure (after a short head start,
      // since it grabbed the treasure from right above the astronaut).
      if (th.fleeT > 0.8 && h.dizzy <= 0 && Math.abs(h.x - th.x) < 50) { this.thiefCaught(); return; }
      if (th.fleeT > 7) this.thiefHides();
      return;
    }
    if (th.state === 'leave') {
      th.x += th.dir * 300 * dt; th.y -= 380 * dt; th.spin += dt * (th.swatted ? 12 : 0);
      if (th.y < -150) { th.state = 'off'; th.swatted = false; th.spin = 0; }
    }
  }

  thiefLeave(swatted) {
    const th = this.thief;
    th.state = 'leave'; th.swatted = swatted;
    th.cool = this.level >= 10 ? 14 : 20;
  }

  thiefCaught() {
    const th = this.thief, tr = th.item;
    th.item = null;
    tr.state = 'pop'; tr.x = th.x; tr.y = th.y + 30; tr.vx = R.range(-80, 80); tr.vy = -420; tr.age = 0;
    sfx('swat'); sfx('coin');
    for (let i = 0; i < 8; i++) this.fx.star(th.x, th.y, { sp: 220 });
    this.thiefLeave(true);
  }

  thiefHides() {
    const th = this.thief, tr = th.item;
    th.item = null;
    // Hides it in a new bush right where it is, in plain sight.
    const x = clamp(th.x, this.minX() + 20, this.maxX() - 20);
    tr.state = 'hidden'; tr.x = x;
    const bush = { type: 'bush', x, y: this.world.groundAt(x) + 4, treasure: tr, used: false, shake: 1, rot: 0, bump: 0 };
    this.hiders.push(bush);
    this.tw.add(bush, { shake: 0 }, 0.6);
    this.fx.dust(x, this.world.groundAt(x), 12);
    sfx('rustle');
    this.thiefLeave(false);
  }

  drawThief(ctx, t) {
    const th = this.thief;
    if (!th || th.state === 'off') return;
    if (th.item) drawTreasure(ctx, th.item.type, th.item.x, th.item.y, t, 0.75, th.item.hue);
    ctx.save();
    ctx.translate(th.x, th.y);
    ctx.rotate(th.spin);
    ctx.scale(1.25, 1.25);
    drawFly(ctx, 0, 0, th.dir, t * 1.5, '#6b5a8e');
    // Bandit mask
    ctx.scale(th.dir, 1);
    ctx.rotate(-0.25);
    rr(ctx, -6, -14, 26, 10, 5); ctx.fillStyle = '#1a1430'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, 12, -9, 2.5); ctx.fill(); circle(ctx, 3, -10, 2); ctx.fill();
    ctx.restore();
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
        if (Math.abs(h.x - b.ax) < (this.danger ? 520 : 420) && this.state === 'play') b.ax += Math.sign(h.x - b.ax) * (this.danger ? 75 : 55) * dt;
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
    if (this.buddy && this.buddy.state === 'follow') this.buddy.dizzy = 1;
    for (let i = 0; i < 5; i++) this.fx.star(h.x, h.y - 100, { sp: 160, r: 8 });
    if (this.danger) {
      this.hearts--;
      this.heartShake = 0.6; this.hurtFlash = 0.5;
      sfx('hurt');
      if (this.hearts <= 0) { this.fail(); return; }
    }
    // Drop the top treasure; it bounces away and has to be picked up again.
    if (h.carry.length) {
      const tr = h.carry.pop();
      tr.state = 'pop'; tr.vx = away * 260; tr.vy = -520; tr.age = 0;
    }
  }

  // Danger planets: second hit. The astronaut falls over and the planet starts over.
  fail() {
    this.state = 'fail';
    const h = this.hero;
    h.dizzy = 99; h.vx = 0; h.target = null; h.carry.forEach((tr) => { tr.state = 'pop'; tr.vx = R.range(-200, 200); tr.vy = -500; tr.age = 0; });
    h.carry = [];
    sfx('lose');
    this.failT = 0;
    // Only if the player is still here (they may have tapped home meanwhile).
    setTimeout(() => { if (this.game.scene === this) this.game.go(new PlanetScene(this.game, this.level, this.cfg)); }, 2200);
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
          if (this.delivered.length === this.treasures.length) {
            if (this.squattersLeft()) {
              // Bugs still on the rocket: shoo them off before anyone can get in.
              this.state = 'clear'; this.idle = 0;
              this.hero.target = null;
              sfx('buzz');
            } else this.complete();
          }
        },
      });
    });
  }

  complete() {
    if (this.state !== 'play' && this.state !== 'clear') return;
    this.state = 'boarding';
    this.time = this.timer;
    this.stars = this.time <= this.par * 1.2 ? 3 : this.time <= this.par * 2 ? 2 : 1;
    const hatsBefore = hatsUnlocked(HATS.length);
    recordLevel(this.level, this.stars, Math.round(this.time), this.cfg);
    const hatsAfter = hatsUnlocked(HATS.length);
    // A new hat! Put it on straight away.
    this.newHat = hatsAfter > hatsBefore ? HATS[hatsAfter - 1] : null;
    if (this.newHat) { save.hat = this.newHat; persist(); }
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
    // The alien buddy hops in too.
    const bd = this.buddy;
    if (bd && bd.visible) {
      setTimeout(() => {
        bd.state = 'board'; bd.happy = 0;
        this.tw.add(bd, { x: this.rx, y: this.ry + HATCH.y + 40 }, 0.5, { arc: 90, ease: ease.inOutQuad, onDone: () => { bd.visible = false; sfx('pop'); } });
      }, 1950);
    }
    setTimeout(() => { this.tw.add(this.hatch, { v: 0 }, 0.3); this.showResults(); }, 2600);
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
    this.drawSquatters(ctx, t);
    if (this.state === 'play' && this.allFound()) {
      // Rocket glows when everything has been found.
      ctx.globalAlpha = 0.3 + Math.sin(t * 6) * 0.2;
      circle(ctx, this.rx, this.ry - 180, 200); ctx.fillStyle = 'rgba(255,240,120,0.35)'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const c of this.crew) {
      if (!c.visible) continue;
      drawAstronaut(ctx, c.x, (c.y ?? w.groundAt(c.x)) - Math.sin(Math.min(1, (c.hop || 0) / 0.5) * Math.PI) * 40, { t: t + c.x, color: c.color, arms: c.cheer > 0 ? 'up' : null, dir: 1, scale: c.s || 1 });
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
    const sp = this.spare;
    if (sp && (sp.state === 'ground' || sp.state === 'pop' || sp.state === 'fly')) {
      const gl = ctx.createRadialGradient(sp.x, sp.y, 5, sp.x, sp.y, 75);
      gl.addColorStop(0, 'rgba(255,240,150,0.7)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = gl; circle(ctx, sp.x, sp.y, 75); ctx.fill();
      drawPartAt(ctx, sp.slot, sp.part, sp.x, sp.y, sp.state === 'fly' ? 0.3 : 0.42, Math.sin(t * 2 + sp.bob) * 0.1);
    }
    for (const b of this.bugs) {
      if (b.gone > 0) {
        ctx.save(); ctx.translate(b.fallX, b.fallY); ctx.rotate(b.spin); ctx.scale(1, -1);
        if (b.kind === 'beetle') drawBeetle(ctx, 0, 24, 1, t, b.color); else drawFly(ctx, 0, 0, 1, t, b.color);
        ctx.restore();
        continue;
      }
      if (this.danger) this.drawDangerAura(ctx, b, t);
      if (b.kind === 'beetle') drawBeetle(ctx, b.x, b.y, b.dir, t, b.color);
      else drawFly(ctx, b.x, b.y, b.dir, t, b.color);
      if (this.danger) this.drawSpikes(ctx, b, t);
    }
    this.drawSleeper(ctx, t);
    this.drawBuddy(ctx, t);
    this.drawThief(ctx, t);
    const h = this.hero;
    if (h.visible !== false && !(h.invuln > 0 && h.dizzy <= 0 && Math.floor(t * 12) % 2)) {
      drawAstronaut(ctx, h.x, h.y, { t, dir: h.dir, walking: h.walking, phase: h.phase, color: CREW_COLORS[0], carrying: h.carry.length > 0, dizzy: h.dizzy > 0, scale: h.s });
    }
    for (const tr of h.carry) drawTreasure(ctx, tr.type, tr.x, tr.y, t, 0.85, tr.hue);
    this.fx.draw(ctx);
    ctx.restore();

    this.drawPointer(ctx);
    this.drawHud(ctx);
    if (this.danger) {
      this.drawHearts(ctx);
      // Red edges: pulse on the last heart, flash when hit.
      const edge = this.hurtFlash > 0 ? this.hurtFlash * 1.2 : (this.hearts === 1 && this.state === 'play' ? 0.25 + Math.sin(this.t * 5) * 0.12 : 0);
      if (edge > 0) {
        const g = ctx.createRadialGradient(V.w / 2, V.h / 2, V.h * 0.35, V.w / 2, V.h / 2, V.w * 0.7);
        g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${Math.min(0.7, edge)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
      }
      if (this.warn > 0) this.drawWarning(ctx);
      if (this.state === 'fail') {
        ctx.fillStyle = `rgba(60,0,10,${Math.min(0.6, this.failT * 0.5)})`; ctx.fillRect(0, 0, V.w, V.h);
      }
    }
    if (this.state === 'results') this.drawResults(ctx);
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }

  // Red pulsing glow behind dangerous bugs.
  drawDangerAura(ctx, b, t) {
    const cy = b.kind === 'beetle' ? b.y - 24 : b.y;
    const r = 60 + Math.sin(t * 6 + b.x) * 8;
    const g = ctx.createRadialGradient(b.x, cy, 10, b.x, cy, r);
    g.addColorStop(0, 'rgba(255,40,40,0.45)'); g.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = g; circle(ctx, b.x, cy, r); ctx.fill();
  }

  // Spikes on the shell (beetle) or a stinger (fly).
  drawSpikes(ctx, b, t) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.dir, 1);
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    if (b.kind === 'beetle') {
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.45, x = Math.cos(a) * 30, y = -24 + Math.sin(a) * 21;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a + 1.4) * 7, y + Math.sin(a + 1.4) * 7);
        ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
        ctx.lineTo(x + Math.cos(a - 1.4) * 7, y + Math.sin(a - 1.4) * 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // angry red eye
      circle(ctx, 34, -26, 3); ctx.fillStyle = '#ff2020'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-34, 12 + Math.sin(t * 10) * 2); ctx.lineTo(-14, 14); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawHearts(ctx) {
    const cx = V.w / 2, y = V.safeT + 50;
    for (let i = 0; i < 2; i++) {
      const full = i < this.hearts;
      const shake = !full && i === this.hearts && this.heartShake > 0 ? Math.sin(this.heartShake * 60) * 6 : 0;
      const pulse = full && this.hearts === 1 ? 1 + Math.sin(this.t * 8) * 0.12 : 1;
      ctx.save(); ctx.translate(cx + (i - 0.5) * 70 + shake, y); ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.bezierCurveTo(-34, -6, -18, -32, 0, -14);
      ctx.bezierCurveTo(18, -32, 34, -6, 0, 18);
      ctx.closePath();
      fs(ctx, full ? '#ff3d5e' : '#6a6070', 4);
      if (full) { ellipse(ctx, -10, -12, 5, 4, -0.5); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(4, 0); ctx.lineTo(-3, 8); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
      ctx.restore();
    }
  }

  // Big warning sign shown when landing on a danger planet.
  drawWarning(ctx) {
    const cx = V.w / 2, cy = V.h * 0.42;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.warn * 2);
    ctx.fillStyle = 'rgba(80,0,10,0.35)'; ctx.fillRect(0, 0, V.w, V.h);
    const s = (0.9 + Math.abs(Math.sin(this.t * 6)) * 0.12) * ease.outBack(Math.min(1, (3 - this.warn) * 3));
    ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(120, 95); ctx.lineTo(-120, 95); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 26; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 16; ctx.strokeStyle = '#ffcc1a'; ctx.stroke();
    ctx.fillStyle = '#e8443a'; ctx.fill();
    ctx.font = '900 130px "Arial Rounded MT Bold", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.strokeText('!', 0, 20);
    ctx.fillStyle = '#ffffff'; ctx.fillText('!', 0, 20);
    ctx.restore();
  }

  allFound() {
    return this.treasures.every((tr) => tr.state === 'carried' || tr.state === 'deliver' || tr.state === 'done');
  }

  // Arrow towards the rocket when all treasures are found, or a hint arrow when idle.
  drawPointer(ctx) {
    if (this.state === 'clear') {
      // Show a hand tapping the next bug on the rocket.
      const q = this.squatters.find((s) => s.state === 'sit' || s.state === 'arrive');
      if (q && this.idle > 1.2) {
        const c = this.squatterPos(q);
        drawHand(ctx, c.x - this.camX + 10, c.y + 10, 1, Math.sin(this.t * 8) > 0 ? 1 : 0);
      }
      return;
    }
    if (this.state !== 'play') return;
    let tx = null, ty = null;
    if (this.thief && this.thief.state === 'flee') { tx = this.thief.x; ty = this.thief.y; }
    else if (this.allFound() && this.hero.carry.length) { tx = this.rx; ty = this.ry - 200; }
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
    // Spare part slot: dashed gold ring until found.
    if (this.spare) {
      const p = this.spareHudPos();
      ctx.save();
      circle(ctx, p.x, p.y, 30);
      if (this.spare.state === 'got') {
        fs(ctx, '#ffe9a0', 4);
        const b = SLOT_BOX[this.spare.slot];
        drawPartAt(ctx, this.spare.slot, this.spare.part, p.x, p.y, 46 / Math.max(b.w, b.h));
      } else {
        ctx.fillStyle = 'rgba(20,14,40,0.35)'; ctx.fill();
        ctx.setLineDash([7, 6]); ctx.lineDashOffset = -this.t * 12;
        ctx.lineWidth = 4; ctx.strokeStyle = '#ffd84d'; ctx.stroke();
      }
      ctx.restore();
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
    const gotSpare = this.spare && this.spare.state === 'got';
    // New hat and/or new part, side by side when both.
    const hatX = gotSpare ? cx + 90 : cx, spareX = this.newHat ? cx - 90 : cx;
    if (this.newHat && r.t > 2) {
      const k = ease.outBack(Math.min(1, (r.t - 2) * 2));
      ctx.save(); ctx.translate(hatX, 432); ctx.scale(k, k);
      ctx.rotate(-this.t * 0.8);
      for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -52); ctx.lineTo(10, -52); ctx.fillStyle = 'rgba(255,120,200,0.35)'; ctx.fill(); }
      ctx.restore();
      drawHat(ctx, this.newHat, hatX, 452, 1.5 * k, this.t);
    }
    if (gotSpare && r.t > 2) {
      // "New part!" with spinning rays
      const k = ease.outBack(Math.min(1, (r.t - 2) * 2));
      ctx.save(); ctx.translate(spareX, 432); ctx.scale(k, k);
      ctx.rotate(this.t * 0.8);
      for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -52); ctx.lineTo(10, -52); ctx.fillStyle = 'rgba(255,210,60,0.35)'; ctx.fill(); }
      ctx.restore();
      const b = SLOT_BOX[this.spare.slot];
      drawPartAt(ctx, this.spare.slot, this.spare.part, spareX, 432, (72 / Math.max(b.w, b.h)) * k);
    }
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
