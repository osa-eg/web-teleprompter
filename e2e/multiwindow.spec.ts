import { expect, test, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

const pos = async (page: Page) => Number(await page.getByTestId('stage').getAttribute('data-pos'));
const role = (page: Page) => page.locator('[data-role]');

test.describe('display window', () => {
  test.use({ locale: 'ar-EG' });

  test('runs the show in a second window and hands it back when closed', async ({ page, context }) => {
    const errors = trackPageErrors(page);
    await page.goto('./');
    await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
    await expect(page.locator('[data-w]').first()).toBeVisible();

    await page.getByTestId('display-button').click();
    const panel = page.getByTestId('display-panel');
    await expect(panel).toContainText('لا توجد نافذة عرض مفتوحة.');
    const [display] = await Promise.all([
      context.waitForEvent('page'),
      panel.getByRole('button', { name: 'فتح نافذة العرض' }).click(),
    ]);
    const displayErrors = trackPageErrors(display);
    await expect(display.locator('[data-w]').first()).toBeVisible();
    await expect(display.getByTestId('display-overlay')).toContainText('متصلة بنافذة التحكم');
    await expect(panel).toContainText('نافذة العرض متصلة');

    // The window the talent reads leads playback; the operator mirrors it.
    await expect(role(display)).toHaveAttribute('data-sync', 'lead');
    await expect(role(page)).toHaveAttribute('data-sync', 'follow');

    // Mirroring is set per window.
    await panel.getByRole('switch', { name: 'عكس أفقي (مرآة)' }).check();
    await expect(display.getByTestId('stage')).toHaveAttribute('data-mirror-h', 'true');
    await expect(page.getByTestId('stage')).not.toHaveAttribute('data-mirror-h');

    // Keys pressed in the operator window drive the display window.
    await panel.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.keyboard.press('Space');
    await expect(display.getByTestId('stage')).toHaveAttribute('data-play-state', /countdown|playing/);
    await expect(display.getByTestId('stage')).toHaveAttribute('data-play-state', 'playing', {
      timeout: 8000,
    });
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'playing');
    // The sample opens with a heading and a note set apart by blank lines, which scroll by first.
    await expect.poll(() => pos(page), { timeout: 15000 }).toBeGreaterThan(3);
    expect(Math.abs((await pos(page)) - (await pos(display)))).toBeLessThan(2);

    // Pause, then close the display: the operator takes over at the same place.
    await page.keyboard.press('Space');
    await expect(display.getByTestId('stage')).toHaveAttribute('data-play-state', 'paused');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'paused');
    const last = await pos(display);
    expect(displayErrors).toEqual([]);
    await display.close();
    // The closing window hands playback over right away (no need to wait for a timeout).
    await expect(role(page)).toHaveAttribute('data-sync', 'lead', { timeout: 1500 });
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'paused');
    expect(Math.abs((await pos(page)) - last)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });

  test('follows the operator to another script', async ({ page, context }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await page.getByTestId('display-button').click();
    const [display] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId('display-panel').getByRole('button', { name: 'فتح نافذة العرض' }).click(),
    ]);
    await expect(display.locator('[data-w]').first()).toBeVisible();
    const firstUrl = display.url();

    // Back to the library, then prompt another script.
    await page.goto('./');
    await page.getByTestId('script-card').nth(1).getByRole('link', { name: 'تشغيل' }).click();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await expect.poll(() => display.url()).not.toBe(firstUrl);
    const scriptId = /#\/s\/([^/]+)\/prompt/.exec(page.url())![1]!;
    expect(display.url()).toContain(`#/s/${scriptId}/display/`);
    await expect(role(display)).toHaveAttribute('data-sync', 'lead');
    await expect(role(page)).toHaveAttribute('data-sync', 'follow');
  });

  test('closes the display window from the operator window', async ({ page, context }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await page.getByTestId('display-button').click();
    const panel = page.getByTestId('display-panel');
    const [display] = await Promise.all([
      context.waitForEvent('page'),
      panel.getByRole('button', { name: 'فتح نافذة العرض' }).click(),
    ]);
    await expect(panel).toContainText('نافذة العرض متصلة');
    // Even after a reload, when this tab no longer holds the window handle.
    await page.reload();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    await page.getByTestId('display-button').click();
    await expect(panel).toContainText('نافذة العرض متصلة');
    await Promise.all([
      display.waitForEvent('close'),
      panel.getByRole('button', { name: 'إغلاق نافذة العرض' }).click(),
    ]);
    await expect(panel).toContainText('لا توجد نافذة عرض مفتوحة.', { timeout: 6000 });
  });
});
