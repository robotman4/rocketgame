// Boot: canvas, resize, input, main loop and scene switching.
import { V } from './core.js';
import { unlockAudio } from './audio.js';
import { TitleScene } from './scenes/title.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const safeEl = document.getElementById('safe');

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  V.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * V.dpr);
  canvas.height = Math.round(h * V.dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  V.h = 768;
  V.w = Math.max(768, (768 * w) / h);
  V.scale = canvas.height / V.h;
  V.ui = h < 500 ? 1.35 : 1;
  const cs = getComputedStyle(safeEl);
  const k = V.h / h;
  V.safeL = parseFloat(cs.paddingLeft) * k || 0;
  V.safeR = parseFloat(cs.paddingRight) * k || 0;
  V.safeT = parseFloat(cs.paddingTop) * k || 0;
  V.safeB = parseFloat(cs.paddingBottom) * k || 0;
  if (game.scene && game.scene.onResize) game.scene.onResize();
}

export const game = {
  scene: null,
  next: null,
  fade: 0,
  fadeDir: 0,
  t: 0,
  // Switch scene with a short fade through dark.
  go(scene) {
    if (this.fadeDir === 1) return;
    this.next = scene;
    this.fadeDir = 1;
  },
};

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- input: one finger at a time ----------
let activeId = null;
const toLogical = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * V.w, y: ((e.clientY - r.top) / r.height) * V.h };
};
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (activeId !== null) return;
  activeId = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (game.fadeDir === 0 && game.scene && game.scene.onDown) game.scene.onDown(toLogical(e));
});
canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (e.pointerId !== activeId) return;
  if (game.scene && game.scene.onMove) game.scene.onMove(toLogical(e));
});
const up = (e) => {
  if (e.pointerId !== activeId) return;
  activeId = null;
  if (game.scene && game.scene.onUp) game.scene.onUp(toLogical(e));
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
// Stop iOS from scrolling / zooming / long-press menus.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.t += dt;
  if (game.fadeDir === 1) {
    game.fade += dt / 0.3;
    if (game.fade >= 1) {
      game.fade = 1;
      if (game.scene && game.scene.exit) game.scene.exit();
      game.scene = game.next; game.next = null;
      if (game.scene.enter) game.scene.enter();
      game.fadeDir = -1;
      activeId = null;
    }
  } else if (game.fadeDir === -1) {
    game.fade -= dt / 0.35;
    if (game.fade <= 0) { game.fade = 0; game.fadeDir = 0; }
  }
  ctx.setTransform(V.scale, 0, 0, V.scale, 0, 0);
  if (game.scene) {
    game.scene.update(dt);
    game.scene.draw(ctx);
  }
  if (game.fade > 0) {
    ctx.fillStyle = `rgba(20,14,40,${game.fade})`;
    ctx.fillRect(0, 0, V.w, V.h);
  }
  requestAnimationFrame(frame);
}

resize();
window.__game = game; // handy for debugging in the browser console
game.scene = new TitleScene(game);
if (game.scene.enter) game.scene.enter();
requestAnimationFrame(frame);
