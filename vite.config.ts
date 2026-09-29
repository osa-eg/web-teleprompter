import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const FONT_FILE = /\.(woff2?|ttf|otf)$/i;

// GitHub Pages serves the app from /<repo>/; the deploy workflow passes the exact path.
const base = process.env.BASE_PATH ?? '/web-teleprompter/';

export default defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [react()],
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
