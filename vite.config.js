import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in the info panel: build date plus short commit id.
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
try { if (!sha) sha = execSync('git rev-parse --short HEAD').toString().trim(); } catch (e) { sha = 'dev'; }
const VERSION = `${new Date().toISOString().slice(0, 10)} (${sha})`;

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: '/rocketgame/',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Rocket Hunt',
        short_name: 'Rocket Hunt',
        description: 'Build a rocket, fly to planets and find treasures.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#1a1446',
        theme_color: '#1a1446',
        start_url: '/rocketgame/',
        scope: '/rocketgame/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
});
