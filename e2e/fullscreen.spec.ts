import { devices, expect, test, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

// Device presets without `defaultBrowserType` (the suite runs in Chromium).
function device(name: string) {
  const { defaultBrowserType, ...options } = devices[name]!;
  void defaultBrowserType;
  return options;
}

async function openPrompter(page: Page) {
  await page.goto('./');
  await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
  await expect(page.locator('[data-w]').first()).toBeVisible();
}

const inFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test.describe('full screen on a phone in landscape', () => {
  test.use({ ...device('Galaxy S9+ landscape'), locale: 'ar-EG' });

  test('keeps the controls to one row and gives the text the whole screen', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openPrompter(page);
    const bar = page.getByTestId('operator-bar');
    await expect(bar).toHaveAttribute('data-compact', 'true');
    expect((await bar.boundingBox())!.height).toBeLessThan(90);

    // The less used tools wait behind "More controls".
    await expect(page.getByTestId('tools')).toHaveCount(0);
    await page.getByTestId('more-tools').tap();
    await expect(page.getByTestId('tools')).toBeVisible();
    await page.getByTestId('more-tools').tap();
    await expect(page.getByTestId('tools')).toHaveCount(0);

    await page.getByTestId('fullscreen-button').tap();
    await expect.poll(() => inFullscreen(page)).toBe(true);
    // In full screen the controls step aside even while paused; a tap brings them back.
    await expect(bar).toHaveAttribute('data-hidden', 'true', { timeout: 5000 });
    await page.getByTestId('stage').tap();
    await expect(bar).not.toHaveAttribute('data-hidden');
    await page.getByTestId('fullscreen-button').tap();
    await expect.poll(() => inFullscreen(page)).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe('full screen on iPhone', () => {
  test.use({ ...device('iPhone 13 landscape'), locale: 'ar-EG' });

  test('explains how to use the whole screen when Safari cannot', async ({ page }) => {
    await page.addInitScript(() => {
      // Like Safari on iPhone: no Fullscreen API for pages.
      for (const name of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
        Object.defineProperty(Document.prototype, name, { get: () => false, configurable: true });
      }
    });
    await openPrompter(page);
    await page.getByTestId('fullscreen-button').tap();
    const help = page.getByTestId('fullscreen-help');
    await expect(help).toBeVisible();
    await expect(help).toContainText('إضافة إلى الشاشة الرئيسية');
    await expect(help).toContainText('إخفاء شريط الأدوات');
    await help.getByRole('button', { name: 'إغلاق' }).tap();
    await expect(help).toBeHidden();
    expect(await inFullscreen(page)).toBe(false);
  });
});

test.describe('full screen on a computer', () => {
  test.use({ locale: 'ar-EG' });

  test('uses the F key and the button next to play', async ({ page }) => {
    await openPrompter(page);
    await expect(page.getByTestId('operator-bar')).not.toHaveAttribute('data-compact');
    await page.keyboard.press('KeyF');
    await expect.poll(() => inFullscreen(page)).toBe(true);
    await page.mouse.move(400, 300);
    await page.getByTestId('fullscreen-button').click();
    await expect.poll(() => inFullscreen(page)).toBe(false);
  });
});
