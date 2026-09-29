import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = '/web-teleprompter/';
const CI = !!process.env.CI;

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
  ],
  webServer: {
    command: CI ? 'npm run preview' : 'npm run build && npm run preview',
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !CI,
    timeout: 240_000,
  },
});
