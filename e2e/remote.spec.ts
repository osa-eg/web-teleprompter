import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { trackPageErrors } from './helpers';

// A local PeerJS signaling server runs next to the app (see playwright.config.ts); no STUN/TURN.
const LOCAL_SERVER = {
  peerHost: '127.0.0.1',
  peerPort: 9000,
  peerPath: '/tp',
  secure: false,
  iceServers: [],
};

async function openPrompterWithRemote(page: Page) {
  await page.addInitScript((remote) => {
    if (!localStorage.getItem('tp:settings')) {
      localStorage.setItem('tp:settings', JSON.stringify({ state: { settings: { remote } }, version: 1 }));
    }
  }, LOCAL_SERVER);
  await page.goto('./');
  await page.getByTestId('script-card').first().getByRole('link', { name: 'تشغيل' }).click();
  await expect(page.locator('[data-w]').first()).toBeVisible();
  await page.getByTestId('remote-button').click();
  const panel = page.getByTestId('remote-panel');
  await panel.getByRole('button', { name: 'تشغيل التحكم بالهاتف' }).click();
  await expect(panel.getByTestId('remote-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 15_000,
  });
  await expect(panel.getByTestId('remote-qr')).toBeVisible();
  return { panel, link: await panel.getByTestId('remote-link').inputValue() };
}

async function openPhone(browser: Browser, link: string) {
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar-EG' });
  const phone = await context.newPage();
  const errors = trackPageErrors(phone);
  await phone.goto(link);
  return { context, phone, errors };
}

test.describe('phone remote', () => {
  test.use({ locale: 'ar-EG' });

  test('controls the prompter from a phone', async ({ page, browser }) => {
    const errors = trackPageErrors(page);
    const { panel, link } = await openPrompterWithRemote(page);
    expect(link).toMatch(/#\/remote\?h=tp-[0-9a-z]{20}&k=[\w-]{22}&s=/);

    const { context, phone, errors: phoneErrors } = await openPhone(browser, link);
    const connection = phone.getByTestId('remote-connection');
    await expect(connection).toHaveAttribute('data-status', 'connected', { timeout: 15_000 });
    await expect(panel.getByTestId('remote-devices')).toContainText('Android');
    await expect(phone.getByRole('heading', { level: 1 })).not.toBeEmpty();

    // Play from the phone; the state comes back to it.
    await phone.getByTestId('remote-play').tap();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-play-state', /countdown|playing/);
    await expect(phone.getByTestId('remote-play')).toHaveAttribute('aria-label', 'إيقاف مؤقت');
    await phone.getByRole('button', { name: 'أسرع' }).tap();
    await expect(page.getByTestId('wpm')).toContainText('125');
    await expect(phone.getByTestId('remote-wpm')).toContainText('125');

    // A disconnected phone reconnects by itself.
    await panel.getByRole('button', { name: 'قطع الاتصال' }).click();
    await expect(connection).toHaveAttribute('data-status', 'reconnecting');
    await expect(connection).toHaveAttribute('data-status', 'connected', { timeout: 15_000 });

    // Turning the remote off leaves the phone waiting for the prompter.
    await panel.getByRole('button', { name: 'إيقاف', exact: true }).click();
    await expect(connection).not.toHaveAttribute('data-status', 'connected', { timeout: 20_000 });
    expect(phoneErrors).toEqual([]);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('rejects a phone with the wrong key', async ({ page, browser }) => {
    const { panel, link } = await openPrompterWithRemote(page);
    const wrong = link.replace(/k=[\w-]{22}/, 'k=AAAAAAAAAAAAAAAAAAAAAA');
    const { context, phone } = await openPhone(browser, wrong);
    await expect(phone.getByTestId('remote-connection')).toHaveAttribute('data-status', 'denied', {
      timeout: 15_000,
    });
    await expect(phone.getByTestId('remote-play')).toBeDisabled();
    await expect(panel).toContainText('لا يوجد هاتف متصل بعد.');
    await context.close();
  });
});
