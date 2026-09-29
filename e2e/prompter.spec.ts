import { expect, test, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

/** Creates a script through the UI, then opens it in the prompter. */
async function openPrompter(page: Page, title: string, body: string) {
  await page.goto('./');
  await page.getByTestId('script-card').first().waitFor();
  await page.getByRole('button', { name: /New script|نص جديد/ }).click();
  await page.getByRole('textbox', { name: /^(Title|العنوان)$/ }).fill(title);
  await page.getByRole('textbox', { name: /^(Script|النص)$/ }).fill(body);
  await expect(page.getByTestId('editor-stats')).toBeVisible();
  await page.getByRole('link', { name: /Start prompting|ابدأ العرض/ }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.locator('[data-w]').first()).toBeVisible();
}

const translateY = (page: Page) =>
  page.getByTestId('stage-content').evaluate((el) => {
    const match = /translate3d\(0px, (-?[\d.]+)px/.exec(el.style.transform);
    return match ? -Number(match[1]) : 0;
  });

const LONG_ARABIC = Array.from(
  { length: 30 },
  (_, i) => `هذه هي الجملة رقم ${i + 1} في نص تجريبي طويل لاختبار التمرير السلس للملقّن.`,
).join('\n');

const BILINGUAL = [
  'iPhone 17 هو أحدث هاتف من شركة Apple حتى الآن.',
  'Welcome to the show, everyone.',
  'مرحباً بكم جميعاً في هذه الحلقة.',
].join('\n');

test.describe('prompter', () => {
  test.use({ locale: 'ar-EG' });

  test('scrolls at the configured words per minute', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.clock.install();
    await openPrompter(page, 'سرعة', LONG_ARABIC);
    await page.clock.runFor(500);

    // Expected speed: wpm/60 × (paragraph height / spoken words).
    const expectedSpeed = await page.evaluate(() => {
      const para = document.querySelector<HTMLElement>('[data-kind="para"]')!;
      const words = document.querySelectorAll('[data-kind="para"] [data-w]').length;
      return (120 / 60) * (para.offsetHeight / words);
    });

    await page.keyboard.press('Space');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'countdown');
    await page.clock.runFor(3000); // countdown
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'playing');
    const start = await translateY(page);
    await page.clock.runFor(4000);
    const moved = (await translateY(page)) - start;
    expect(moved).toBeGreaterThan(expectedSpeed * 4 * 0.9);
    expect(moved).toBeLessThan(expectedSpeed * 4 * 1.1);

    // Space pauses; the text then stays put.
    await page.keyboard.press('Space');
    await page.clock.runFor(1500);
    const paused = await translateY(page);
    await page.clock.runFor(2000);
    expect(await translateY(page)).toBeCloseTo(paused, 0);
    expect(errors).toEqual([]);
  });

  test('changes speed with the arrow keys', async ({ page }) => {
    await openPrompter(page, 'مفاتيح', LONG_ARABIC);
    const wpm = page.getByTestId('stage');
    await expect(wpm).toHaveAttribute('data-wpm', '120');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(wpm).toHaveAttribute('data-wpm', '130');
    await page.keyboard.press('ArrowDown');
    await expect(wpm).toHaveAttribute('data-wpm', '125');
  });

  test('gives every line its own direction', async ({ page }) => {
    await openPrompter(page, 'اتجاه', BILINGUAL);
    const lines = page.getByTestId('stage-content').locator('[dir]');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toHaveAttribute('dir', 'rtl');
    await expect(lines.nth(1)).toHaveAttribute('dir', 'ltr');
    await expect(lines.nth(2)).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('stage')).toHaveAttribute('dir', 'rtl');

    // Right-to-left lines start at the right padding edge, left-to-right ones at the left.
    const edges = await page.getByTestId('stage-content').evaluate((content) => {
      const box = content.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(content).paddingInlineStart);
      return [...content.querySelectorAll('[dir]')].map((line) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        const text = range.getBoundingClientRect();
        return { left: text.left - box.left, right: box.right - text.right, pad };
      });
    });
    expect(Math.abs(edges[0]!.right - edges[0]!.pad)).toBeLessThan(2);
    expect(Math.abs(edges[1]!.left - edges[1]!.pad)).toBeLessThan(2);
    expect(Math.abs(edges[2]!.right - edges[2]!.pad)).toBeLessThan(2);
  });

  test('never letter-spaces Arabic lines', async ({ page }) => {
    await openPrompter(page, 'تباعد', BILINGUAL);
    // Stored settings are validated field by field, so a partial object is enough.
    await page.evaluate(() => {
      const settings = { appearance: { letterSpacing: 0.2 } };
      localStorage.setItem('tp:settings', JSON.stringify({ state: { settings }, version: 1 }));
    });
    await page.reload();
    await expect(page.locator('[data-w]').first()).toBeVisible();
    const spacing = await page
      .getByTestId('stage-content')
      .locator('[dir]')
      .evaluateAll((lines) => lines.map((l) => getComputedStyle(l).letterSpacing));
    expect(spacing[0]).toBe('normal');
    expect(spacing[1]).not.toBe('normal');
  });

  test('mirrors the stage and moves the guide arrow to the other side', async ({ page }) => {
    await openPrompter(page, 'مرآة', LONG_ARABIC);
    const arrow = page.getByTestId('guide-arrow');
    const before = (await arrow.boundingBox())!;
    await page.keyboard.press('KeyM');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-mirror-h', 'true');
    const matrix = await page.getByTestId('stage').evaluate((el) => getComputedStyle(el).transform);
    expect(matrix).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    const after = (await arrow.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(before.x).toBeGreaterThan(width / 2);
    expect(after.x).toBeLessThan(width / 2);
  });

  test('keeps the same word on the reading line when the text size changes', async ({ page }) => {
    await openPrompter(page, 'حجم', LONG_ARABIC);
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(1500);

    const wordAtGuide = () =>
      page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('[data-testid="stage"]')!;
        const box = stage.getBoundingClientRect();
        const pct = Number(getComputedStyle(stage).getPropertyValue('--tp-reading'));
        const y = box.top + (box.height * pct) / 100;
        const words = [...document.querySelectorAll<HTMLElement>('[data-w]')];
        let best = -1;
        let bestDistance = Infinity;
        for (const word of words) {
          const r = word.getBoundingClientRect();
          const distance = Math.abs((r.top + r.bottom) / 2 - y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = Number(word.dataset.w);
          }
        }
        return best;
      });

    const before = await wordAtGuide();
    for (let i = 0; i < 4; i++) await page.keyboard.press('BracketRight');
    await page.waitForTimeout(600);
    const after = await wordAtGuide();
    expect(Math.abs(after - before)).toBeLessThanOrEqual(8);

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(600);
    expect(Math.abs((await wordAtGuide()) - before)).toBeLessThanOrEqual(8);
  });

  test('pauses at a cue and ends at the end', async ({ page }) => {
    await page.clock.install();
    await openPrompter(page, 'إشارة', 'السطر الأول من النص.\n[توقف]\nالسطر الأخير.');
    await page.clock.runFor(300);
    await page.keyboard.press('Space');
    await page.clock.runFor(3000 + 15_000);
    const stage = page.getByTestId('stage');
    await expect(stage).toHaveAttribute('data-play-state', 'paused');
    await page.keyboard.press('Space');
    await page.clock.runFor(20_000);
    await expect(stage).toHaveAttribute('data-play-state', 'ended');
  });

  test('shows the keyboard help and jumps back to the editor with Escape', async ({ page }) => {
    await openPrompter(page, 'مساعدة', LONG_ARABIC);
    await page.keyboard.press('Shift+Slash');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/edit$/);
  });

  test('survives a denied wake lock', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'wakeLock', {
        value: { request: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      });
    });
    const errors = trackPageErrors(page);
    await openPrompter(page, 'قفل', LONG_ARABIC);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe('prompter on touch devices @mobile', () => {
  test('drag scrolls the text', async ({ page }) => {
    await openPrompter(page, 'Touch', LONG_ARABIC);
    const stage = page.getByTestId('stage');
    const box = (await stage.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height * 0.4, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    expect(await translateY(page)).toBeGreaterThan(50);
  });
});
