import { expect, test } from '@playwright/test';
import { openLibrary, trackPageErrors } from './helpers';

test.describe('app shell', () => {
  test('loads under the base path without errors', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openLibrary(page);
    await expect(page.getByTestId('script-card')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test.describe('Arabic browser', () => {
    test.use({ locale: 'ar-EG' });

    test('starts right-to-left in Arabic', async ({ page }) => {
      await openLibrary(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('نصوصك');
    });
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });

    test('starts left-to-right and flips when switching to Arabic', async ({ page }) => {
      await openLibrary(page);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('dir', 'ltr');

      const nav = page.getByRole('navigation');
      const library = nav.getByRole('link', { name: 'Library' });
      const settings = nav.getByRole('link', { name: 'Settings' });
      const ltrOrder = (await library.boundingBox())!.x < (await settings.boundingBox())!.x;
      expect(ltrOrder).toBe(true);

      await page.getByRole('button', { name: 'Switch the interface to Arabic' }).click();
      await expect(html).toHaveAttribute('dir', 'rtl');
      await expect(html).toHaveAttribute('lang', 'ar');
      const libraryAr = page.getByRole('navigation').getByRole('link', { name: 'المكتبة' });
      const settingsAr = page.getByRole('navigation').getByRole('link', { name: 'الإعدادات' });
      expect((await libraryAr.boundingBox())!.x).toBeGreaterThan((await settingsAr.boundingBox())!.x);

      // The choice survives a reload (and is applied before first paint).
      await page.reload();
      await expect(html).toHaveAttribute('dir', 'rtl');
    });
  });

  test('creates a script that survives a reload', async ({ page }) => {
    await openLibrary(page);
    await page.getByRole('button', { name: /New script|نص جديد/ }).click();
    await expect(page).toHaveURL(/#\/s\/[a-z0-9]+\/edit$/);

    await page.getByRole('textbox', { name: /Title|العنوان/ }).fill('خطاب الافتتاح');
    await page.getByRole('textbox', { name: /^(Script|النص)$/ }).fill('مرحباً بكم في حفل الافتتاح.');
    await expect(page.getByText(/^(Saved|تم الحفظ)$/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: /Title|العنوان/ })).toHaveValue('خطاب الافتتاح');
    await expect(page.getByRole('textbox', { name: /^(Script|النص)$/ })).toHaveValue(
      'مرحباً بكم في حفل الافتتاح.',
    );
  });

  test('deep links survive a reload', async ({ page }) => {
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Settings|الإعدادات/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Settings|الإعدادات/);
  });

  test('deleting a script can be undone', async ({ page }) => {
    await openLibrary(page);
    const cards = page.getByTestId('script-card');
    await expect(cards).toHaveCount(3);
    await cards
      .first()
      .getByRole('button', { name: /Delete|حذف/ })
      .click();
    await expect(cards).toHaveCount(2);
    await page.getByRole('button', { name: /Undo|تراجع/ }).click();
    await expect(cards).toHaveCount(3);
  });
});
