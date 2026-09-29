import { expect, test, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

const LONG_ARABIC = Array.from(
  { length: 30 },
  (_, i) => `هذه هي الجملة رقم ${i + 1} في نص تجريبي طويل لاختبار التمرير السلس للملقّن.`,
).join('\n');

declare global {
  interface Window {
    __fakeSpeech: { active: unknown; lang: string; say(text: string, final?: boolean): boolean };
  }
}

/** Settings for the test, written before the app loads (partial settings are merged with defaults). */
async function useSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem('tp:settings')) {
      localStorage.setItem('tp:settings', JSON.stringify({ state: { settings: value }, version: 1 }));
    }
  }, settings);
}

async function openPrompter(page: Page, title: string, body: string) {
  await page.goto('./');
  await page.getByTestId('script-card').first().waitFor();
  await page.getByRole('button', { name: 'نص جديد' }).click();
  await page.getByRole('textbox', { name: 'العنوان' }).fill(title);
  await page.getByRole('textbox', { name: 'النص', exact: true }).fill(body);
  await expect(page.getByTestId('editor-stats')).toBeVisible();
  await page.getByRole('link', { name: 'ابدأ العرض' }).click();
  await expect(page.locator('[data-w]').first()).toBeVisible();
}

const translateY = (page: Page) =>
  page.getByTestId('stage-content').evaluate((el) => {
    const match = /translate3d\(0px, (-?[\d.]+)px/.exec(el.style.transform);
    return match ? -Number(match[1]) : 0;
  });

test.describe('voice control', () => {
  test.use({ locale: 'ar-EG' });

  test('follows the words the talent reads', async ({ page }) => {
    const errors = trackPageErrors(page);
    await useSettings(page, { voice: { mode: 'follow', lang: 'ar-SA' }, behavior: { countdownSec: 0 } });
    await page.addInitScript(() => {
      localStorage.setItem('tp:voice-consent', '1');
      // A scripted stand-in for the browser's speech recognition.
      class FakeRecognition {
        lang = '';
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onstart: ((e: Event) => void) | null = null;
        onend: ((e: Event) => void) | null = null;
        onresult: ((e: Event) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        start() {
          window.__fakeSpeech.active = this;
          window.__fakeSpeech.lang = this.lang;
          setTimeout(() => this.onstart?.(new Event('start')));
        }
        stop() {
          this.abort();
        }
        abort() {
          if (window.__fakeSpeech.active === this) window.__fakeSpeech.active = null;
          setTimeout(() => this.onend?.(new Event('end')));
        }
      }
      const w = window as unknown as Record<string, unknown>;
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
      window.__fakeSpeech = {
        active: null,
        lang: '',
        say(text, final = true) {
          const recognition = this.active as FakeRecognition | null;
          if (!recognition?.onresult) return false;
          const result = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final });
          const event = Object.assign(new Event('result'), { resultIndex: 0, results: [result] });
          recognition.onresult(event);
          return true;
        },
      };
    });
    await openPrompter(page, 'متابعة الصوت', LONG_ARABIC);

    await page.getByTestId('voice-button').click();
    await expect(page.getByTestId('voice-status')).toHaveAttribute('data-status', 'listening');
    expect(await page.evaluate(() => window.__fakeSpeech.lang)).toBe('ar-SA');
    await page.keyboard.press('Space');
    const stage = page.getByTestId('stage');
    await expect(stage).toHaveAttribute('data-play-state', 'playing');

    // Only speech moves the text in this mode.
    const start = await translateY(page);
    await page.waitForTimeout(800);
    expect(await translateY(page)).toBe(start);

    // Words from the third sentence: the last one is marked and brought to the reading line.
    expect(
      await page.evaluate(() => window.__fakeSpeech.say('هذه هي الجملة رقم 3 في نص تجريبي', false)),
    ).toBe(true);
    const spoken = page.locator('.is-spoken');
    await expect(spoken).toHaveText('تجريبي');
    const offset = () =>
      page.evaluate(() => {
        const word = document.querySelector('.is-spoken')!.getBoundingClientRect();
        const band = document.querySelector('[data-testid="guide-band"]')!.getBoundingClientRect();
        const content = document.querySelector<HTMLElement>('[data-testid="stage-content"]')!;
        const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
        return Math.abs(word.top + word.height / 2 - (band.top + band.height / 2)) / lineHeight;
      });
    await expect.poll(offset, { timeout: 5000 }).toBeLessThan(1.2);
    const third = await translateY(page);
    expect(third).toBeGreaterThan(start);

    // Reading on moves the text on; turning voice off hands back to the automatic scroll.
    await page.evaluate(() =>
      window.__fakeSpeech.say('طويل لاختبار التمرير السلس للملقن هذه هي الجملة رقم 4', true),
    );
    await expect(spoken).toHaveText('4');
    await expect.poll(() => translateY(page)).toBeGreaterThan(third);
    await page.keyboard.press('KeyV');
    await expect(page.getByTestId('voice-status')).toHaveCount(0);
    await expect(spoken).toHaveCount(0);
    const off = await translateY(page);
    await expect.poll(() => translateY(page)).toBeGreaterThan(off + 5);
    expect(errors).toEqual([]);
  });

  test('asks before sending audio to a speech service', async ({ page }) => {
    await useSettings(page, { voice: { mode: 'follow' } });
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition = class {};
    });
    await openPrompter(page, 'موافقة', 'نص قصير للاختبار.');
    await page.getByTestId('voice-button').click();
    const dialog = page.getByRole('dialog', { name: 'التعرّف على الكلام' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('voice-button')).toHaveAttribute('aria-pressed', 'false');
  });

  test('scrolls only while the talent speaks @vad', async ({ page }) => {
    const errors = trackPageErrors(page);
    await useSettings(page, {
      voice: { mode: 'vad', vadSensitivityDb: 12 },
      behavior: { countdownSec: 0, wpm: 240 },
    });
    await openPrompter(page, 'كشف الكلام', LONG_ARABIC);
    await page.getByTestId('voice-button').click();
    const status = page.getByTestId('voice-status');
    await expect(status).toHaveAttribute('data-status', /listening|speaking/);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', 'playing');

    // The fake microphone loops 2 s of tone and 2 s of quiet: the text must both move and hold.
    await expect(status).toHaveAttribute('data-status', 'speaking', { timeout: 8000 });
    await expect(status).toHaveAttribute('data-status', 'listening', { timeout: 8000 });
    const samples: number[] = [];
    for (let i = 0; i < 70; i++) {
      samples.push(await translateY(page));
      await page.waitForTimeout(100);
    }
    const steps = samples.slice(1).map((y, i) => y - samples[i]!);
    expect(steps.filter((d) => d > 0.5).length).toBeGreaterThan(10);
    expect(steps.filter((d) => Math.abs(d) < 0.01).length).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
});
