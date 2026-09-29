import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = '/web-teleprompter/';
const CI = !!process.env.CI;
// Chromium needs a UTF-8 locale to keep non-ASCII (Arabic) download file names.
const env = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } as Record<string, string>;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          env,
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
          ],
        },
      },
      testIgnore: [/pwa\.spec\.ts/],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
    {
      name: 'pwa',
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
      testMatch: [/pwa\.spec\.ts/],
    },
  ],
  webServer: {
    command: CI ? 'npm run preview' : 'npm run build && npm run preview',
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !CI,
    timeout: 240_000,
  },
});
