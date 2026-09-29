import { expect, type Page } from '@playwright/test';

/** Fails the test on uncaught page errors, console errors and failed same-origin requests. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith('http://localhost')) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

/** Opens the library and waits until the seeded scripts are rendered. */
export async function openLibrary(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('script-card').first()).toBeVisible();
}
