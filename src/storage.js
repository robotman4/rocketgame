// Progress saved on the device. One player, no profiles.
const KEY = 'rocketgame.v1';
export const LEVELS = 30;
// Planets after this one are the harder "danger zone" (two hearts, restart on the second hit).
export const DANGER_FROM = 21;
export const isDanger = (level) => level >= DANGER_FROM;

const defaults = () => ({ stars: Array(LEVELS + 1).fill(0), unlocked: 1, muted: false, bestTimes: Array(LEVELS + 1).fill(0), rockets: Array(LEVELS + 1).fill(null), spares: [] });

export const save = (() => {
  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(defaults(), JSON.parse(raw));
    // Saves from before there were 30 planets have shorter arrays.
    const d = defaults();
    for (const k of ['stars', 'bestTimes', 'rockets']) while (data[k].length < d[k].length) data[k].push(d[k][data[k].length]);
  } catch (e) { /* private mode etc: play without saving */ }
  return data;
})();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

// cfg is the rocket the player flew there with; the map shows it next to the planet.
export function recordLevel(level, stars, seconds, cfg) {
  if (cfg) save.rockets[level] = cfg;
  save.stars[level] = Math.max(save.stars[level] || 0, stars);
  if (!save.bestTimes[level] || seconds < save.bestTimes[level]) save.bestTimes[level] = seconds;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS, level + 1));
  persist();
}

// Spare parts found on planets; they show up in the workshop from then on.
export function hasSpare(level) { return save.spares.some((sp) => sp.level === level); }
export function addSpare(spare) {
  if (hasSpare(spare.level)) return;
  save.spares.push(spare);
  persist();
}
