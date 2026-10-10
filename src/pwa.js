// Service worker registration. When a new version is deployed, `pwa.ready` turns true
// and the title/map screens show an update button instead of updating silently.
import { registerSW } from 'virtual:pwa-register';

export const pwa = { ready: false, apply() {}, justUpdated: false, check: async () => 'error' };
let registration = null;

// Set just before reloading into a new version, so the title screen can celebrate it.
const FLAG = 'rocketgame.justUpdated';
try {
  if (localStorage.getItem(FLAG)) { pwa.justUpdated = true; localStorage.removeItem(FLAG); }
} catch (e) { /* ignore */ }

const updateSW = registerSW({
  onNeedRefresh() { pwa.ready = true; },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    registration = reg;
    // A home screen app can stay open for days, so look for new versions every 2 hours.
    setInterval(() => reg.update().catch(() => {}), 2 * 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  },
});

// Progress lives in localStorage, so reloading into the new version keeps it.
pwa.apply = () => {
  try { localStorage.setItem(FLAG, '1'); } catch (e) { /* ignore */ }
  updateSW(true);
  // updateSW reloads once the new worker takes control. A page that was never controlled
  // (e.g. the very first visit) gets no such signal, so reload anyway shortly after.
  setTimeout(() => window.location.reload(), 1500);
};

// Manual "check for updates" from the info panel. Resolves to 'available', 'latest' or 'error'.
pwa.check = async () => {
  if (pwa.ready) return 'available';
  if (!registration || !navigator.onLine) return 'error';
  try {
    await registration.update();
    // If a new version is downloading, wait for it to finish installing.
    const sw = registration.installing;
    if (sw) {
      await new Promise((res) => {
        const t = setTimeout(res, 15000);
        sw.addEventListener('statechange', () => { if (sw.state === 'installed' || sw.state === 'redundant') { clearTimeout(t); res(); } });
      });
    }
    // onNeedRefresh runs right after install; give it a moment.
    await new Promise((r) => setTimeout(r, 300));
    return pwa.ready || registration.waiting ? (pwa.ready = true, 'available') : 'latest';
  } catch (e) {
    return 'error';
  }
};
