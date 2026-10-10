// All sound is synthesized with WebAudio: chiptune music + simple effects. No audio files.
import { save, persist } from './storage.js';

let ctx = null, master, musicBus, sfxBus, noiseBuf, pulse25, pulse12;
// Set when iOS may have left the audio context "running" but silent (after the app was in
// the background or the audio was interrupted). The next tap then rebuilds the context.
let stale = false;
// iOS keeps a context created before the first touch silent, even after resume().
// So nothing is created until the first tap; music asked for before that waits here.
let touched = false, pendingSong = null;

// iOS 17+: play like a media app, so audio is not tied to the silent switch and is
// less likely to be cut off by other sounds.
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }

function init() {
  if (ctx || !touched) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  ctx.onstatechange = () => { if (ctx && ctx.state === 'interrupted') stale = true; };
  master = ctx.createGain();
  master.gain.value = save.muted ? 0 : 1;
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  pulse25 = pulseWave(0.25);
  pulse12 = pulseWave(0.125);
}

// Narrow pulse waves give the classic keygen / 8-bit tone.
function pulseWave(duty) {
  const n = 64, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

// Throw away the audio context and start over, keeping the current song playing.
function rebuild() {
  const song = current && current.name;
  if (timer) clearInterval(timer);
  timer = null; current = null;
  try { ctx.close(); } catch (e) { /* ignore */ }
  ctx = null;
  init();
  if (song) playMusic(song);
}

// A short silent buffer started inside a touch is what really wakes audio up on iOS.
function kick() {
  try {
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(ctx.destination); src.start(0);
  } catch (e) { /* ignore */ }
}

// Called on every touch. iOS only allows audio to start from a touch.
export function unlockAudio() {
  if (!touched) {
    touched = true;
    init();
    if (pendingSong) { const song = pendingSong; pendingSong = null; playMusic(song); }
  }
  if (ctx && stale) { stale = false; rebuild(); }
  init();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  kick();
}

// Wake audio on every kind of touch event; iOS does not count all of them as a user gesture.
for (const ev of ['touchend', 'pointerup', 'click']) document.addEventListener(ev, unlockAudio, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) {
    ctx.suspend().catch(() => {});
    // iOS may hand back a context that says "running" but plays nothing. Rebuild on next tap.
    stale = true;
  } else {
    ctx.resume().catch(() => {});
  }
});

export function isMuted() { return save.muted; }
export function toggleMute() {
  save.muted = !save.muted;
  persist();
  if (!save.muted && ctx) { rebuild(); return; }
  if (master) master.gain.setTargetAtTime(save.muted ? 0 : 1, ctx.currentTime, 0.05);
}

// ---------- low level voices ----------
function osc(type, freq, t0, dur, vol, bus, slideTo, attack = 0.005) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (type === 'p25') o.setPeriodicWave(pulse25);
  else if (type === 'p12') o.setPeriodicWave(pulse12);
  else o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(t0, dur, vol, bus, filterType = 'lowpass', freq = 1200, freqTo) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freq, t0);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
  return { s, g };
}

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midi(name) {
  const m = name.match(/^([A-G]#?)(\d)$/);
  return 12 * (parseInt(m[2]) + 1) + NOTE[m[1]];
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- sound effects ----------
const sfxDefs = {
  pick() { const t = ctx.currentTime; osc('p25', 520, t, 0.08, 0.25, sfxBus, 900); },
  snap() {
    const t = ctx.currentTime;
    noise(t, 0.05, 0.5, sfxBus, 'highpass', 3000);
    osc('p25', 660, t, 0.08, 0.3, sfxBus);
    osc('p25', 990, t + 0.07, 0.14, 0.3, sfxBus);
  },
  bounce() { const t = ctx.currentTime; osc('sine', 300, t, 0.3, 0.4, sfxBus, 90); },
  tap() { const t = ctx.currentTime; osc('p12', 880, t, 0.05, 0.2, sfxBus); },
  coin() {
    const t = ctx.currentTime;
    osc('p25', mtof(83), t, 0.07, 0.25, sfxBus);
    osc('p25', mtof(88), t + 0.07, 0.35, 0.25, sfxBus);
  },
  deliver() {
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => osc('p25', mtof(m), t + i * 0.06, 0.12, 0.22, sfxBus));
  },
  jump() { const t = ctx.currentTime; osc('p25', 220, t, 0.18, 0.25, sfxBus, 660); },
  bump() { const t = ctx.currentTime; osc('square', 140, t, 0.12, 0.3, sfxBus, 80); noise(t, 0.08, 0.3, sfxBus, 'lowpass', 900); },
  pop() { const t = ctx.currentTime; osc('sine', 400, t, 0.12, 0.4, sfxBus, 1200); },
  rock() { const t = ctx.currentTime; noise(t, 0.35, 0.6, sfxBus, 'lowpass', 500, 120); osc('triangle', 90, t, 0.3, 0.4, sfxBus, 50); },
  rustle() { const t = ctx.currentTime; noise(t, 0.3, 0.35, sfxBus, 'bandpass', 2500, 1200); },
  buzz() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 180;
    lfo.frequency.value = 30; lg.gain.value = 40;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(sfxBus);
    o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
  },
  hit() {
    const t = ctx.currentTime;
    osc('sine', 500, t, 0.35, 0.4, sfxBus, 120);
    osc('p25', 300, t + 0.05, 0.2, 0.15, sfxBus, 200);
  },
  swat() { const t = ctx.currentTime; noise(t, 0.08, 0.6, sfxBus, 'highpass', 2000); osc('p25', 900, t, 0.25, 0.2, sfxBus, 2400); },
  beep() { const t = ctx.currentTime; osc('p25', 880, t, 0.18, 0.3, sfxBus); },
  beepHigh() { const t = ctx.currentTime; osc('p25', 1320, t, 0.4, 0.3, sfxBus); },
  star(i = 0) {
    const t = ctx.currentTime, base = [76, 79, 84][i] || 84;
    [0, 4, 7, 12].forEach((s, k) => osc('p25', mtof(base + s), t + k * 0.05, 0.15, 0.22, sfxBus));
  },
  ready() {
    const t = ctx.currentTime;
    [67, 72, 76, 79, 84].forEach((m, i) => osc('p25', mtof(m), t + i * 0.08, 0.2, 0.22, sfxBus));
  },
  whoosh() { const t = ctx.currentTime; noise(t, 0.5, 0.4, sfxBus, 'bandpass', 400, 3000); },
  thud() { const t = ctx.currentTime; osc('sine', 120, t, 0.5, 0.7, sfxBus, 35); noise(t, 0.6, 0.5, sfxBus, 'lowpass', 600, 100); },
  fanfare() {
    const t = ctx.currentTime;
    const seq = [[72, 0], [72, 0.12], [72, 0.24], [76, 0.36], [79, 0.6], [76, 0.78], [79, 0.9], [84, 1.05]];
    seq.forEach(([m, d], i) => osc('p25', mtof(m), t + d, i === seq.length - 1 ? 0.7 : 0.14, 0.25, sfxBus));
    seq.forEach(([m, d]) => osc('triangle', mtof(m - 24), t + d, 0.14, 0.3, sfxBus));
  },
};

export function sfx(name, arg) {
  if (!ctx || ctx.state !== 'running') return;
  sfxDefs[name] && sfxDefs[name](arg);
}

// Long engine rumble for launches. Returns a stop function.
export function rumble(dur = 6) {
  if (!ctx) return () => {};
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(900, t + 1.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.6);
  s.connect(f); f.connect(g); g.connect(sfxBus);
  s.start(t);
  let stopped = false;
  const own = ctx; // the context may be rebuilt before this stops
  const stop = (fade = 1) => {
    if (stopped) return; stopped = true;
    if (own.state === 'closed') return;
    try {
      const n = own.currentTime;
      g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + fade);
      s.stop(n + fade + 0.05);
    } catch (e) { /* ignore */ }
  };
  setTimeout(() => stop(1), dur * 1000);
  return stop;
}

// ---------- music ----------
// Songs: chord per bar, lead as 16 tokens per bar ('-' rest, '.' hold).
const SONGS = {
  map: {
    bpm: 132,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    lead: [
      'E5 . G5 . C6 . . . B5 . G5 . E5 . . .',
      'D5 . G5 . B5 . . . A5 . G5 . D5 . . .',
      'C5 . E5 . A5 . . . G5 . E5 . C5 . D5 .',
      'F5 . . . A5 . . . G5 . F5 . E5 . D5 .',
      'E5 . G5 . C6 . E6 . D6 . C6 . G5 . . .',
      'B5 . . . D6 . . . B5 . A5 . G5 . . .',
      'A5 . . . C6 . A5 . G5 . F5 . A5 . . .',
      'G5 . . . . . . . - - G5 A5 B5 . D6 .',
    ],
  },
  build: {
    bpm: 118,
    chords: ['C', 'F', 'C', 'G'],
    lead: [
      'G4 . C5 . E5 . C5 . G4 . C5 . E5 . G5 .',
      'A4 . C5 . F5 . C5 . A4 . C5 . F5 . A5 .',
      'G5 . E5 . C5 . E5 . G5 . . . C6 . . .',
      'B5 . A5 . G5 . F5 . D5 . . . - - - -',
    ],
  },
  planet: {
    bpm: 140,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    lead: [
      'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .',
      'F5 . . . E5 . . . C5 . A4 . C5 . . .',
      'E5 . G5 . C6 . . . B5 . G5 . E5 . G5 .',
      'D5 . . . B4 . D5 . G5 . . . - - - -',
      'A5 . . . E5 . A5 . C6 . B5 . A5 . . .',
      'F5 . A5 . C6 . A5 . F5 . . . E5 . . .',
      'G5 . E5 . C5 . E5 . G5 . C6 . E6 . . .',
      'D6 . . . B5 . . . G5 . . . - - - -',
    ],
  },
  space: { bpm: 100, chords: ['Em', 'C', 'G', 'D'], lead: null, noDrums: true },
};

function chordTones(name) {
  const minor = name.endsWith('m');
  const root = midi(name.replace('m', '') + '3');
  return [root, root + (minor ? 3 : 4), root + 7];
}

function parseLead(bars) {
  const events = [];
  bars.forEach((bar, b) => {
    const toks = bar.trim().split(/\s+/).slice(0, 16);
    toks.forEach((tok, i) => {
      if (tok === '-') { if (events.length) events[events.length - 1].open = false; return; }
      if (tok === '.') { if (events.length && events[events.length - 1].open) events[events.length - 1].len++; return; }
      if (events.length) events[events.length - 1].open = false;
      events.push({ step: b * 16 + i, m: midi(tok), len: 1, open: true });
    });
    if (events.length) events[events.length - 1].open = toks[toks.length - 1] === '.';
  });
  return events;
}

let current = null, timer = null;

export function playMusic(name) {
  if (!touched) { pendingSong = name; return; }
  init();
  if (!ctx) return;
  if (current && current.name === name) return;
  stopMusic();
  const song = SONGS[name];
  const stepDur = 60 / song.bpm / 4;
  const steps = song.chords.length * 16;
  const lead = song.lead ? parseLead(song.lead) : [];
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.connect(musicBus);
  bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
  current = { name, bus, step: 0, next: ctx.currentTime + 0.1 };
  const cur = current;
  const schedule = () => {
    if (!ctx || ctx.state !== 'running') { cur.next = ctx ? ctx.currentTime + 0.1 : 0; return; }
    // After a stall (busy frame, app paused) skip ahead instead of playing all missed notes at once.
    if (cur.next < ctx.currentTime - 0.1) cur.next = ctx.currentTime + 0.05;
    while (cur.next < ctx.currentTime + 0.15) {
      const s = cur.step % steps, t = cur.next;
      const bar = Math.floor(s / 16), i = s % 16;
      const tones = chordTones(song.chords[bar]);
      // Arp: root, third, fifth, octave, fast like an old keygen.
      const arp = [tones[0], tones[1], tones[2], tones[0] + 12][i % 4] + 24;
      osc('p12', mtof(arp), t, stepDur * 0.9, name === 'space' ? 0.07 : 0.045, bus);
      // Bass
      const bassPat = { 0: 0, 2: 0, 4: 12, 6: 0, 8: 0, 10: 12, 12: 7, 14: 12 };
      if (bassPat[i] !== undefined) osc('triangle', mtof(tones[0] - 12 + bassPat[i]), t, stepDur * 1.6, 0.28, bus);
      // Lead
      for (const ev of lead) if (ev.step === s) osc('p25', mtof(ev.m), t, stepDur * ev.len * 0.95, 0.09, bus, null, 0.01);
      // Drums
      if (!song.noDrums) {
        if (i === 0 || i === 8 || i === 10) osc('sine', 150, t, 0.15, 0.5, bus, 40);
        if (i === 4 || i === 12) noise(t, 0.12, 0.18, bus, 'highpass', 1500);
        if (i % 2 === 0) noise(t, 0.03, 0.06, bus, 'highpass', 7000);
      }
      cur.step++;
      cur.next += stepDur;
    }
  };
  timer = setInterval(schedule, 25);
  schedule();
}

export function stopMusic() {
  pendingSong = null;
  if (timer) clearInterval(timer);
  timer = null;
  if (current && ctx && ctx.state !== 'closed') {
    const b = current.bus;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(Math.max(b.gain.value, 0.0001), ctx.currentTime);
    b.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(() => b.disconnect(), 600);
  }
  current = null;
}
