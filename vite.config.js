import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: '/rocketgame/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
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
