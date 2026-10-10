import { V, R } from '../core.js';
import { World } from '../world.js';
import { drawRocket, randomPart, DRAW_ORDER } from '../rocket.js';
import { drawAstronaut, INK } from '../draw.js';
import { Button, layoutTopRight, updateButton, layoutTopLeft, tapUpdate } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { pwa } from '../pwa.js';
import { InfoPanel } from '../info.js';
import { MapScene } from './map.js';
import { Gift } from '../celebrate.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.world = new World(0);
    this.cfg = {};
    for (const s of DRAW_ORDER) this.cfg[s] = randomPart(s, R);
    this.play = new Button('play', '#5cc95a', 70);
    this.play.pulse = true;
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.infoBtn = new Button('info', '#9b5de5', 36);
    this.info = new InfoPanel();
    this.updBtn = updateButton();
    this.fx = new Particles();
    // Just updated: show a present to open.
    this.gift = pwa.justUpdated ? new Gift() : null;
    pwa.justUpdated = false;
    this.onResize();
  }
  onResize() {
    this.world = new World(0);
    this.play.x = V.w / 2 + 230; this.play.y = 470;
    layoutTopLeft(this.updBtn);
    layoutTopRight([this.sound, this.infoBtn]);
  }
  enter() { playMusic('map'); }
  onDown(p) {
    if (this.info.onDown(p, this.fx)) return;
    if (this.gift && !this.gift.done) { this.gift.onDown(p); return; }
    this.updBtn.visible = pwa.ready;
    if (this.updBtn.hit(p)) { tapUpdate(this.updBtn, this.fx); return; }
    if (this.infoBtn.hit(p)) { this.info.show(); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.play.hit(p)) {
      sfx('pop');
      this.game.go(new MapScene(this.game));
      return;
    }
    this.fx.burst(p.x, p.y, 8);
    sfx('tap');
  }
  update(dt) { this.t += dt; this.fx.update(dt); this.info.update(dt); if (this.gift) this.gift.update(dt); }
  draw(ctx) {
    const t = this.t, w = this.world;
    w.drawBackground(ctx, 0, 0, t);
    const rx = V.w / 2 - 120, ry = w.groundAt(rx);
    drawRocket(ctx, rx, ry - 4 + Math.sin(t * 2) * 3, this.cfg, { crew: true });
    drawAstronaut(ctx, rx + 120, ry, { t, color: '#f5962a', arms: 'up', dir: -1 });
    drawAstronaut(ctx, rx - 130, ry, { t: t + 1, color: '#5cc95a', walking: false, dir: 1 });
    // Logo
    ctx.save();
    ctx.translate(V.w / 2, 150 + Math.sin(t * 1.5) * 6);
    ctx.rotate(-0.04);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 92px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
    const word = 'ROCKET HUNT';
    const colors = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5'];
    let total = ctx.measureText(word).width, x = -total / 2;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], cw = ctx.measureText(ch).width;
      const y = Math.sin(t * 4 + i * 0.6) * 6;
      ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.strokeText(ch, x + cw / 2, y);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(ch, x + cw / 2, y);
      x += cw;
    }
    ctx.restore();
    this.play.draw(ctx, t);
    this.updBtn.visible = pwa.ready || this.updBtn.spinning;
    this.updBtn.draw(ctx, t);
    this.sound.draw(ctx, t);
    this.infoBtn.draw(ctx, t);
    this.info.draw(ctx, t);
    this.fx.draw(ctx);
    if (this.gift) this.gift.draw(ctx, this.t);
  }
}
