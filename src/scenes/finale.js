// Shown after planet 20: fireworks, dancing crew, big trophy.
import { V, R } from '../core.js';
import { drawStars } from '../world.js';
import { drawAstronaut, drawAlien, starPath, fs, rr, INK } from '../draw.js';
import { save } from '../storage.js';
import { Button, layoutTopRight } from '../ui.js';
import { sfx, playMusic, toggleMute } from '../audio.js';
import { Particles } from '../particles.js';
import { CREW_COLORS } from './flight.js';
import { MapScene } from './map.js';

export class FinaleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.fx = new Particles();
    this.next = 0.3;
    this.home = new Button('home', '#f5962a', 50);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.onResize();
  }
  onResize() { layoutTopRight([this.sound]); this.home.x = V.w / 2; this.home.y = 680; }
  enter() { playMusic('map'); sfx('fanfare'); }
  onDown(p) {
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p) && this.t > 1.5) { sfx('pop'); this.game.go(new MapScene(this.game)); return; }
    this.fx.firework(p.x, p.y); sfx('pop');
  }
  update(dt) {
    this.t += dt;
    this.fx.update(dt);
    this.next -= dt;
    if (this.next <= 0) {
      this.next = R.range(0.4, 0.9);
      this.fx.firework(R.range(100, V.w - 100), R.range(80, 320));
      sfx('pop');
    }
  }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#0d0b2e'); g.addColorStop(1, '#3a2470');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    drawStars(ctx, t * 10, 0, t, 1);
    this.fx.draw(ctx);
    // trophy
    const cx = V.w / 2, cy = 330 + Math.sin(t * 2) * 8;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 1.5) * 0.05);
    ctx.beginPath(); ctx.moveTo(-90, -120); ctx.lineTo(90, -120); ctx.quadraticCurveTo(90, 20, 0, 40); ctx.quadraticCurveTo(-90, 20, -90, -120); ctx.closePath();
    fs(ctx, '#ffcc1a', 6);
    ctx.beginPath(); ctx.arc(-95, -70, 34, Math.PI * 0.5, Math.PI * 1.5); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffcc1a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(95, -70, 34, -Math.PI * 0.5, Math.PI * 0.5); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffcc1a'; ctx.stroke();
    rr(ctx, -16, 36, 32, 50, 6); fs(ctx, '#ffcc1a', 5);
    rr(ctx, -70, 84, 140, 34, 8); fs(ctx, '#a0602d', 5);
    starPath(ctx, 0, -50, 46, 20); fs(ctx, '#fff3a0', 5);
    ctx.restore();
    // dancing crew
    CREW_COLORS.forEach((c, i) => {
      const x = cx + [-330, 220, 330][i], y = 640 - Math.abs(Math.sin(t * 5 + i)) * 40;
      drawAstronaut(ctx, x, y, { t: t + i, color: c, arms: 'up', dir: i ? -1 : 1 });
    });
    if (save.buddy) drawAlien(ctx, V.w / 2 - 210, 640 - Math.abs(Math.sin(t * 6)) * 50, { t, happy: true, hat: save.hat, squash: Math.max(0, Math.cos(t * 12)) * 0.5 });
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }
}
