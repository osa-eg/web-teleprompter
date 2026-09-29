import { expect, test } from '@playwright/test';

test.describe('settings', () => {
  test.use({ locale: 'ar-EG' });

  test('assigns a new key to an action and uses it in the prompter', async ({ page }) => {
    await page.goto('./#/settings/keyboard');
    const row = page.locator('tr[data-action="togglePlay"]');
    await row.getByRole('button', { name: 'إضافة مفتاح' }).click();
    await expect(row.getByRole('button', { name: 'اضغط مفتاحاً…' })).toBeVisible();
    await page.keyboard.press('KeyJ');
    await expect(row.locator('kbd', { hasText: /^J$/ })).toBeVisible();

    await page.goto('./');
    await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await page.keyboard.press('KeyJ');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', /countdown|playing/);
  });

  test('moves a key that was used by another action', async ({ page }) => {
    await page.goto('./#/settings/keyboard');
    await page.locator('tr[data-action="reset"]').getByRole('button', { name: 'إضافة مفتاح' }).click();
    await page.keyboard.press('KeyM'); // M mirrors by default
    await expect(page.locator('tr[data-action="reset"] kbd', { hasText: /^M$/ })).toBeVisible();
    await expect(page.locator('tr[data-action="mirrorH"] kbd', { hasText: /^M$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'استعادة النمط' }).click();
    await expect(page.locator('tr[data-action="mirrorH"] kbd', { hasText: /^M$/ })).toBeVisible();
  });

  test('saves and applies a look', async ({ page }) => {
    await page.goto('./#/settings/presets');
    await page.getByRole('textbox', { name: 'اسم لهذا المظهر' }).fill('استوديو');
    await page.getByRole('button', { name: 'حفظ المظهر الحالي' }).click();
    await expect(page.getByText('استوديو')).toBeVisible();

    await page.goto('./#/settings/display');
    await page.getByRole('button', { name: 'أسود على أبيض' }).click();
    await page.goto('./#/settings/presets');
    await page.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page.getByText('طُبّق «استوديو»')).toBeVisible();
    const colors = await page.evaluate(
      () => JSON.parse(localStorage.getItem('tp:settings')!).state.settings.appearance.colors.bg,
    );
    expect(colors).toBe('#000000');
  });

  test('shows font licenses', async ({ page }) => {
    await page.goto('./#/settings/about');
    await page.locator('summary', { hasText: '56 خطاً' }).click();
    await expect(page.getByText('الأميري', { exact: true })).toBeVisible();
    await expect(page.getByText(/The Amiri Project Authors/).first()).toBeVisible();
  });
});
