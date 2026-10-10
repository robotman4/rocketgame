// Progress saved on the device. One player, no profiles.
const KEY = 'rocketgame.v1';
export const LEVELS = 20;

const defaults = () => ({ stars: Array(LEVELS + 1).fill(0), unlocked: 1, muted: false, bestTimes: Array(LEVELS + 1).fill(0), rockets: Array(LEVELS + 1).fill(null) });

export const save = (() => {
  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(defaults(), JSON.parse(raw));
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
