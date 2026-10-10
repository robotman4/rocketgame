// Build the rocket: drag (or tap) parts lying around onto the dashed outline.
import { V, R, dist, ease, Tweens, shade } from '../core.js';
import { World } from '../world.js';
import { drawRocket, drawPad, drawPartAt, slotCenter, SLOT_BOX, DRAW_ORDER, VARIANTS, COLORS } from '../rocket.js';
import { INK, rr, fs, drawHand, drawArrow, circle } from '../draw.js';
import { Button, layoutTopRight } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { save } from '../storage.js';
import { Particles } from '../particles.js';
import { FlightScene } from './flight.js';
import { MapScene } from './map.js';

const GROUND_SCALE = 0.48;
const SNAP_DIST = 150;

export class BuildScene {
  constructor(game, level) {
    this.game = game;
    this.level = level; // destination planet
    this.from = level - 1;
    this.world = new World(this.from);
    // Small props look too much like rocket parts, keep the build area clean.
    this.world.decor = this.world.decor.filter((d) => !['flower', 'moonRock', 'lavaRock', 'crater', 'cloudPuff', 'snowman'].includes(d.type));
    this.t = 0;
    this.tw = new Tweens();
    this.fx = new Particles();
    this.placed = {};
    this.parts = [];
    this.drag = null;
    this.idle = 0;
    this.ready = false;
    this.wiggle = 0;
    this.launch = new Button('launch', '#e8443a', 62);
    this.launch.enabled = false;
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.rx = this.world.rocketX;
    this.ry = this.world.groundAt(this.rx) - (this.from === 0 ? 22 : 0);
    this.makeParts();
    this.onResize();
  }

  makeParts() {
    // Two options per slot, always different from each other.
    const list = [];
    for (const slot of DRAW_ORDER) {
      const v1 = R.int(0, VARIANTS[slot] - 1);
      let v2 = (v1 + R.int(1, VARIANTS[slot] - 1)) % VARIANTS[slot];
      const c1 = R.pick(COLORS);
      let c2 = R.pick(COLORS); while (c2 === c1) c2 = R.pick(COLORS);
      list.push({ slot, part: { variant: v1, color: c1 } }, { slot, part: { variant: v2, color: c2 } });
    }
    // Shuffle so the options for one slot end up in different places.
    for (let i = list.length - 1; i > 0; i--) { const j = R.int(0, i); [list[i], list[j]] = [list[j], list[i]]; }
    // Spare parts found on planets: the newest one plus one random older one, on the gold shelf.
    const found = save.spares.slice();
    const spares = [];
    if (found.length) spares.push(found.pop());
    if (found.length) spares.push(found[R.int(0, found.length - 1)]);
    for (const sp of spares) list.push({ slot: sp.slot, part: { ...sp.part }, spare: true });
    this.spareCount = spares.length;
    this.parts = list.map((p) => ({ ...p, x: 0, y: 0, s: GROUND_SCALE, rot: 0, homeX: 0, homeY: 0, homeRot: 0, state: 'ground' }));
  }

  // Spots: per side 3 on the ground and 2 on a floating brick shelf.
  layoutSpots() {
    const spots = [];
    const shelfY = this.world.groundAt(this.rx) - 250;
    this.shelves = [];
    for (const side of [-1, 1]) {
      const inner = this.rx + side * 175;
      const outer = side < 0 ? V.safeL + 70 : V.w - V.safeR - 70;
      const lerpX = (f) => inner + (outer - inner) * f;
      for (const f of [0.12, 0.5, 0.88]) {
        const x = lerpX(f);
        spots.push({ x, surface: this.world.groundAt(x) });
      }
      const sx0 = lerpX(0.18), sx1 = lerpX(0.82);
      this.shelves.push({ x0: Math.min(sx0, sx1) - 30, x1: Math.max(sx0, sx1) + 30, y: shelfY });
      for (const f of [0.3, 0.7]) spots.push({ x: lerpX(f), surface: shelfY });
    }
    // Gold shelf above the rocket for spare parts.
    this.goldShelf = null;
    if (this.spareCount) {
      const y = 150 + V.safeT;
      const n = this.spareCount;
      this.goldShelf = { x0: this.rx - n * 70 - 10, x1: this.rx + n * 70 + 10, y };
      for (let i = 0; i < n; i++) spots.push({ x: this.rx + (i - (n - 1) / 2) * 140, surface: y });
    }
    return spots;
  }

  onResize() {
    layoutTopRight([this.sound, this.home]);
    this.launch.x = V.w - V.safeR - 100;
    this.launch.y = 210 + V.safeT;
    const spots = this.layoutSpots();
    this.parts.forEach((p, i) => {
      const sp = spots[i];
      const b = SLOT_BOX[p.slot];
      p.homeX = sp.x;
      p.homeY = sp.surface - (b.h / 2) * GROUND_SCALE - 2;
      p.homeRot = (R() - 0.5) * 0.3;
      if (p.state === 'ground') { p.x = p.homeX; p.y = p.homeY; p.rot = p.homeRot; }
    });
  }

  enter() { playMusic('build'); }

  slotPos(slot) {
    const c = slotCenter(slot);
    return { x: this.rx + c.x, y: this.ry + c.y };
  }

  partAt(p) {
    let best = null, bd = 1e9;
    for (const part of this.parts) {
      if (part.state !== 'ground') continue;
      const b = SLOT_BOX[part.slot];
      const hw = (b.w / 2) * part.s + 26, hh = (b.h / 2) * part.s + 26;
      if (Math.abs(p.x - part.x) < hw && Math.abs(p.y - part.y) < hh) {
        const d = dist(p.x, p.y, part.x, part.y);
        if (d < bd) { bd = d; best = part; }
      }
    }
    if (best) return best;
    // Placed parts can be pulled off again. Check small parts first.
    for (const slot of ['window', 'nose', 'engine', 'fins', 'body']) {
      const part = this.placed[slot];
      if (!part) continue;
      const b = SLOT_BOX[slot];
      const lx = p.x - this.rx, ly = p.y - this.ry;
      if (lx > b.x - 10 && lx < b.x + b.w + 10 && ly > b.y - 10 && ly < b.y + b.h + 10) return part;
    }
    return null;
  }

  onDown(p) {
    this.idle = 0;
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new MapScene(this.game)); return; }
    if (this.launch.hit(p)) { this.doLaunch(); return; }
    const part = this.partAt(p);
    if (!part) { this.fx.burst(p.x, p.y, 5); return; }
    this.tw.cancel(part);
    if (part.state === 'placed') {
      this.placed[part.slot] = null;
      this.setReady(false);
    }
    part.state = 'drag';
    this.drag = { part, ox: part.x - p.x, oy: part.y - p.y, x0: p.x, y0: p.y, moved: 0, time: performance.now() };
    this.tw.add(part, { s: 1, rot: 0 }, 0.15, { ease: ease.outBack });
    // Lift the part above the finger so it stays visible.
    this.tw.add(this.drag, { ox: 0, oy: -50 }, 0.2);
    sfx('pick');
  }

  onMove(p) {
    if (!this.drag) return;
    const d = this.drag;
    d.moved = Math.max(d.moved, dist(p.x, p.y, d.x0, d.y0));
    d.part.x = p.x + d.ox;
    d.part.y = p.y + d.oy;
  }

  onUp(p) {
    if (!this.drag) return;
    const d = this.drag, part = d.part;
    this.drag = null;
    this.tw.cancel(d);
    const tap = d.moved < 14 && performance.now() - d.time < 350;
    const sp = this.slotPos(part.slot);
    if (tap || dist(part.x, part.y, sp.x, sp.y) < SNAP_DIST) {
      this.place(part, tap);
    } else {
      this.sendHome(part, true);
    }
  }

  place(part, flying) {
    const sp = this.slotPos(part.slot);
    const old = this.placed[part.slot];
    if (old && old !== part) this.sendHome(old, false);
    part.state = 'fly';
    this.placed[part.slot] = null;
    this.tw.cancel(part);
    this.tw.add(part, { x: sp.x, y: sp.y, s: 1, rot: 0 }, flying ? 0.5 : 0.18, {
      ease: flying ? ease.inOutQuad : ease.outQuad,
      arc: flying ? 120 : 0,
      onDone: () => {
        part.state = 'placed';
        this.placed[part.slot] = part;
        sfx('snap');
        this.wiggle = 0.3;
        for (let i = 0; i < 8; i++) this.fx.star(sp.x, sp.y, { sp: 200, r: 9, life: 0.6 });
        if (DRAW_ORDER.every((s) => this.placed[s])) this.setReady(true);
      },
    });
  }

  sendHome(part, bounce) {
    part.state = 'fly';
    this.tw.cancel(part);
    if (bounce) sfx('bounce');
    this.tw.add(part, { x: part.homeX, y: part.homeY, s: GROUND_SCALE, rot: part.homeRot }, 0.45, {
      ease: ease.outBack, arc: 60, onDone: () => { part.state = 'ground'; },
    });
  }

  setReady(v) {
    if (v === this.ready) return;
    this.ready = v;
    this.launch.enabled = v;
    this.launch.pulse = v;
    if (v) {
      sfx('ready');
      this.idle = 0;
      this.fx.confetti(this.rx, this.ry - 380, 50);
    }
  }

  doLaunch() {
    if (!this.ready || this.launching) return;
    this.launching = true;
    sfx('pop');
    const cfg = {};
    for (const s of DRAW_ORDER) cfg[s] = { ...this.placed[s].part };
    this.game.scene = new FlightScene(this.game, { from: this.from, to: this.level, cfg, world: this.world });
    this.game.scene.enter();
  }

  update(dt) {
    this.t += dt;
    this.idle += dt;
    this.wiggle = Math.max(0, this.wiggle - dt);
    this.tw.update(dt);
    this.fx.update(dt);
  }

  cfg() {
    const c = {};
    for (const s of DRAW_ORDER) c[s] = this.placed[s] ? this.placed[s].part : null;
    return c;
  }

  draw(ctx) {
    const t = this.t, w = this.world;
    w.drawBackground(ctx, 0, 0, t);
    // floating brick shelves (Mario style)
    for (const sh of this.shelves) {
      for (let x = sh.x0; x < sh.x1; x += 44) {
        rr(ctx, x, sh.y, 44, 30, 4); fs(ctx, '#c8662a', 3);
        ctx.beginPath(); ctx.moveTo(x + 22, sh.y + 15); ctx.lineTo(x + 22, sh.y + 30); ctx.moveTo(x, sh.y + 15); ctx.lineTo(x + 44, sh.y + 15);
        ctx.lineWidth = 2; ctx.strokeStyle = shade('#c8662a', -0.4); ctx.stroke();
      }
    }
    if (this.from === 0) drawPad(ctx, this.rx, this.ry);
    const dragSlot = this.drag ? this.drag.part.slot : this.hintSlot;
    const wig = this.wiggle > 0 ? Math.sin(this.wiggle * 40) * 0.02 : (this.ready ? Math.sin(t * 8) * 0.01 : 0);
    drawRocket(ctx, this.rx, this.ry, this.cfg(), { ghost: true, glow: dragSlot, t, rot: wig });
    // parts on the ground, then anything moving, then the dragged part on top
    if (this.goldShelf) {
      const g = this.goldShelf;
      const glow = ctx.createRadialGradient(this.rx, g.y - 40, 10, this.rx, g.y - 40, 170);
      glow.addColorStop(0, 'rgba(255,230,120,0.45)'); glow.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = glow; ctx.fillRect(this.rx - 180, g.y - 200, 360, 260);
      rr(ctx, g.x0, g.y, g.x1 - g.x0, 22, 8); fs(ctx, '#ffcc1a', 4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(g.x0 + 10, g.y + 4, g.x1 - g.x0 - 20, 4);
    }
    for (const p of this.parts) if (p.state === 'ground') drawPartAt(ctx, p.slot, p.part, p.x, p.y + Math.sin(t * 2 + p.homeX) * 2, p.s, p.rot);
    for (const p of this.parts) if (p.state === 'fly') drawPartAt(ctx, p.slot, p.part, p.x, p.y, p.s, p.rot);
    if (this.drag) {
      const p = this.drag.part;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 14;
      drawPartAt(ctx, p.slot, p.part, p.x, p.y, p.s, p.rot);
      ctx.restore();
    }
    this.fx.draw(ctx);
    this.drawHint(ctx);
    this.launch.draw(ctx, t);
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }

  drawHint(ctx) {
    this.hintSlot = null;
    if (this.drag) return;
    if (this.ready) {
      if (this.idle > 2) {
        drawArrow(ctx, this.launch.x - 120 - Math.abs(Math.sin(this.t * 5)) * 16, this.launch.y, 0, 1.1);
      }
      return;
    }
    if (this.idle < 5) return;
    // Show a hand dragging an unplaced part to its slot.
    const todo = this.parts.filter((p) => p.state === 'ground' && !this.placed[p.slot]);
    if (!todo.length) return;
    const p = todo[Math.floor(this.idle / 2.2) % todo.length];
    const sp = this.slotPos(p.slot);
    this.hintSlot = p.slot;
    const k = ((this.idle - 5) % 2.2) / 2.2;
    const m = ease.inOutQuad(Math.min(1, Math.max(0, (k - 0.15) / 0.65)));
    const hx = p.x + (sp.x - p.x) * m, hy = p.y + (sp.y - p.y) * m;
    ctx.globalAlpha = k > 0.9 ? (1 - k) * 10 : Math.min(1, k * 8);
    circle(ctx, hx, hy, 20 + Math.sin(this.t * 10) * 3); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    drawHand(ctx, hx + 6, hy + 4, 1, k < 0.15 ? 1 : 0);
    ctx.globalAlpha = 1;
  }
}
