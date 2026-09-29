import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fontsourceWoff2Only } from './scripts/vite-fontsource-woff2-only.ts';

const FONT_FILE = /\.(woff2?|ttf|otf)$/i;
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// GitHub Pages serves the app from /<repo>/; the deploy workflow passes the exact path.
const base = process.env.BASE_PATH ?? '/web-teleprompter/';

export default defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    fontsourceWoff2Only(),
    react(),
    VitePWA({
      // Never reload on its own: an update is applied only when the user accepts it (not mid-read).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Web Teleprompter · الملقّن',
        short_name: 'الملقّن',
        description:
          'ملقّن نصوص احترافي بدعم كامل للعربية — A professional teleprompter with first-class Arabic support',
        lang: 'ar',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell and the default font are precached; other fonts are cached on first use.
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          '**/cairo-{arabic,latin,latin-ext}-wght-normal-*.woff2',
        ],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tp-fonts',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    sourcemap: true,
    // Never inline fonts as base64 into CSS: they must stay separate, cacheable files.
    assetsInlineLimit: (file) => (FONT_FILE.test(file) ? false : undefined),
  },
  preview: { port: 4173, strictPort: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.ts', 'src/**/*.test.tsx'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
