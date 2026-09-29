import { stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

async function useSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem('tp:settings')) {
      localStorage.setItem('tp:settings', JSON.stringify({ state: { settings: value }, version: 1 }));
    }
  }, settings);
}

async function openPrompter(page: Page, body?: string) {
  await page.goto('./');
  await page.getByTestId('script-card').first().waitFor();
  if (body) {
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.getByRole('textbox', { name: 'العنوان' }).fill('تسجيل');
    await page.getByRole('textbox', { name: 'النص', exact: true }).fill(body);
    await expect(page.getByTestId('editor-stats')).toBeVisible();
    await page.getByRole('link', { name: 'ابدأ العرض' }).click();
  } else {
    await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
  }
  await expect(page.locator('[data-w]').first()).toBeVisible();
}

const FILE_NAME = /^teleprompter-\d{8}-\d{4}\.(webm|mp4)$/;

test.describe('camera and recording', () => {
  test.use({ locale: 'ar-EG', permissions: ['camera', 'microphone'] });

  test('previews the camera and records a take', async ({ page }) => {
    const errors = trackPageErrors(page);
    await useSettings(page, { camera: { recordWithPlay: false, layout: 'pip' } });
    await openPrompter(page);

    await page.getByTestId('camera-button').click();
    await expect(page.getByTestId('camera-layer')).toHaveAttribute('data-layout', 'pip');
    await expect
      .poll(() => page.getByTestId('camera-video').evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);

    const record = page.getByTestId('record-button');
    await record.click();
    await expect(record).toHaveAttribute('data-state', 'recording');
    await expect(record).toContainText('0:02', { timeout: 5000 });
    const [download] = await Promise.all([page.waitForEvent('download'), record.click()]);
    expect(download.suggestedFilename()).toMatch(FILE_NAME);
    const { size } = await stat(await download.path());
    expect(size).toBeGreaterThan(10_000);
    await expect(page.getByText(/^حُفظ التسجيل/)).toBeVisible();
    await expect(record).toHaveAttribute('data-state', 'idle');
    expect(errors).toEqual([]);
  });

  test('records with the script: starts after the countdown and stops at the end', async ({ page }) => {
    await useSettings(page, {
      camera: { recordWithPlay: true, layout: 'background' },
      behavior: { countdownSec: 1, wpm: 300 },
    });
    // About 20 words: a take of roughly four seconds.
    await openPrompter(
      page,
      'هذا نص قصير للتسجيل مع التشغيل.\nيبدأ التسجيل بعد العد التنازلي مباشرة.\nثم يتوقف وحده عند نهاية النص ويُحفظ الملف.',
    );

    const record = page.getByTestId('record-button');
    await record.click();
    await expect(record).toHaveAttribute('data-state', 'armed');
    // The camera turned on behind the text.
    await expect(page.getByTestId('camera-layer')).toHaveAttribute('data-layout', 'background');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-backdrop', 'true');

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.keyboard.press('Space');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'countdown');
    await expect(record).toHaveAttribute('data-state', 'armed');
    await expect(record).toHaveAttribute('data-state', 'recording', { timeout: 5000 });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(FILE_NAME);
    expect((await stat(await download.path())).size).toBeGreaterThan(10_000);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'ended');
    await expect(record).toHaveAttribute('data-state', 'idle');
  });
});
