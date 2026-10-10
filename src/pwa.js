// Service worker registration. When a new version is deployed, `pwa.ready` turns true
// and the title/map screens show an update button instead of updating silently.
import { registerSW } from 'virtual:pwa-register';

export const pwa = { ready: false, apply() {} };

const updateSW = registerSW({
  onNeedRefresh() { pwa.ready = true; },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    // A home screen app can stay open for days, so look for new versions regularly.
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  },
});

// Progress lives in localStorage, so reloading into the new version keeps it.
pwa.apply = () => {
  updateSW(true);
  // updateSW reloads once the new worker takes control. A page that was never controlled
  // (e.g. the very first visit) gets no such signal, so reload anyway shortly after.
  setTimeout(() => window.location.reload(), 1500);
};
