import { expect, test } from '@playwright/test';

test.describe('installable offline app', () => {
  test('keeps working offline after the first visit', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.getByTestId('script-card').first()).toBeVisible();
    // Wait until the service worker has installed and precached the app shell.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active?.state !== 'activated') {
        await new Promise<void>((resolve) =>
          registration.active?.addEventListener('statechange', () => resolve(), { once: true }),
        );
      }
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('script-card').first()).toBeVisible();
    await page
      .getByTestId('script-card')
      .first()
      .getByRole('link', { name: /Prompt|تشغيل/ })
      .click();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    // The default font is precached, so the prompter renders in Cairo while offline.
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('600 48px "Cairo Variable"', 'مرحبا')))
      .toBe(true);
  });

  test('serves a manifest scoped to the base path', async ({ page, baseURL }) => {
    const response = await page.request.get(new URL('manifest.webmanifest', baseURL).toString());
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as { scope: string; start_url: string; icons: unknown[] };
    expect(manifest.scope).toBe('/web-teleprompter/');
    expect(manifest.start_url).toBe('/web-teleprompter/');
    expect(manifest.icons).toHaveLength(3);
  });
});
