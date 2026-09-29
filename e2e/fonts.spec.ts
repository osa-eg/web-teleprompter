import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FONT_FILE = fileURLToPath(
  new URL('../node_modules/@fontsource/lalezar/files/lalezar-arabic-400-normal.woff2', import.meta.url),
);

async function openSettings(page: Page) {
  await page.goto('./');
  await page.getByTestId('script-card').first().waitFor();
  await page
    .getByTestId('script-card')
    .first()
    .getByRole('link', { name: /Prompt|تشغيل/ })
    .click();
  await expect(page.locator('[data-w]').first()).toBeVisible();
  await page.getByRole('button', { name: /Display settings|إعدادات العرض/ }).click();
  await expect(page.getByTestId('quick-settings')).toBeVisible();
}

async function openPicker(page: Page) {
  await page
    .getByTestId('quick-settings')
    .getByRole('button', { name: /^(Change|تغيير)$/ })
    .first()
    .click();
  await expect(page.getByTestId('font-picker')).toBeVisible();
}

test.describe('fonts', () => {
  test.use({ locale: 'ar-EG' });

  test('loads a catalog font (WOFF2 only) and applies its line height', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(woff2?|ttf|otf)(\?|$)/.test(request.url())) fontRequests.push(request.url());
    });
    await openSettings(page);
    await openPicker(page);
    await page
      .getByTestId('font-picker')
      .getByRole('button', { name: /الأميري/ })
      .first()
      .click();
    await expect(page.getByTestId('font-picker')).toBeHidden();
    await expect(page.getByTestId('font-field-primary')).toHaveText('الأميري');

    await expect
      .poll(() => page.evaluate(() => document.fonts.check('400 64px Amiri', 'بسم')), { timeout: 10_000 })
      .toBe(true);
    const content = page.getByTestId('stage-content');
    await expect(content).toHaveCSS('font-family', /^Amiri/);
    const metrics = await content.evaluate((el) => {
      const style = getComputedStyle(el);
      return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
    });
    expect(metrics).toBeCloseTo(2, 1);

    expect(fontRequests.some((url) => url.includes('amiri-arabic-400'))).toBe(true);
    expect(fontRequests.filter((url) => /\.woff(\?|$)/.test(url))).toEqual([]);
  });

  test('offers only Latin fonts for the separate Latin font', async ({ page }) => {
    await openSettings(page);
    await page
      .getByTestId('quick-settings')
      .getByRole('button', { name: /^(Change|تغيير)$/ })
      .nth(1)
      .click();
    const picker = page.getByTestId('font-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button', { name: /إنتر/ })).toBeVisible();
    await expect(picker.getByRole('button', { name: /الأميري/ })).toHaveCount(0);
    await picker.getByRole('button', { name: /إنتر/ }).click();
    await expect(page.getByTestId('stage-content')).toHaveCSS(
      'font-family',
      /^"Inter Variable", "Cairo Variable"/,
    );
  });

  test('filters and searches the library', async ({ page }) => {
    await openSettings(page);
    await openPicker(page);
    const picker = page.getByTestId('font-picker');
    await picker.getByRole('searchbox').fill('كوفي');
    await expect(picker.getByRole('button', { name: /نوتو كوفي/ })).toBeVisible();
    await expect(picker.getByRole('button', { name: /الأميري/ })).toHaveCount(0);
    await picker.getByRole('searchbox').fill('amiri');
    await expect(picker.getByRole('button', { name: /الأميري قرآن/ })).toBeVisible();
  });

  test('uploads a custom font that survives a reload', async ({ page }) => {
    await openSettings(page);
    await openPicker(page);
    await page.getByTestId('font-upload').setInputFiles(FONT_FILE);
    await expect(page.getByTestId('font-picker')).toBeHidden();
    await expect(page.getByTestId('font-field-primary')).toHaveText('lalezar arabic');
    await expect(page.getByTestId('stage-content')).toHaveCSS('font-family', /^"?tp-u-/);

    await page.reload();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.fonts].some((face) => face.family.includes('tp-u-') && face.status === 'loaded'),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('lists fonts installed on the computer', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { queryLocalFonts: () => Promise<unknown[]> }).queryLocalFonts = async () => [
        { family: 'Fake Local Font', fullName: 'Fake Local Font', postscriptName: 'Fake', style: 'Regular' },
      ];
    });
    await openSettings(page);
    await openPicker(page);
    await page.getByRole('button', { name: /عرض كل الخطوط المثبتة/ }).click();
    await page
      .getByTestId('font-picker')
      .getByRole('button', { name: /Fake Local Font/ })
      .click();
    await expect(page.getByTestId('stage-content')).toHaveCSS('font-family', /^"Fake Local Font"/);
  });
});
