import { expect, test } from '@playwright/test';

test.describe('editor', () => {
  test.use({ locale: 'ar-EG' });

  test('formats the selection, previews it and undoes with Ctrl+Z', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    const body = page.getByRole('textbox', { name: 'النص' });
    await body.fill('مرحبا بكم');
    await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 5));

    await page.getByRole('button', { name: /عريض/ }).click();
    await expect(body).toHaveValue('**مرحبا** بكم');

    const preview = page.getByTestId('preview');
    if (!(await preview.isVisible())) await page.getByRole('button', { name: 'إظهار المعاينة' }).click();
    await expect(page.getByTestId('preview').locator('strong')).toHaveText('مرحبا');

    await body.focus();
    await page.keyboard.press('Control+z');
    await expect(body).toHaveValue('مرحبا بكم');
  });

  test('forces a line direction with the direction button', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    const body = page.getByRole('textbox', { name: 'النص' });
    await body.fill('Hello world');
    const preview = page.getByTestId('preview');
    if (!(await preview.isVisible())) await page.getByRole('button', { name: 'إظهار المعاينة' }).click();
    await expect(preview.locator('[dir]').first()).toHaveAttribute('dir', 'ltr');

    await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 3));
    await page.getByRole('button', { name: /اتجاه السطر/ }).click();
    await expect(preview.locator('[dir]').first()).toHaveAttribute('dir', 'rtl');
  });

  test('fixes lines that the editor would show in the wrong direction', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    const body = page.getByRole('textbox', { name: 'النص' });
    await body.fill('iPhone 17 هو أحدث هاتف من شركة Apple');
    await page.getByRole('button', { name: 'تصحيح الاتجاه' }).click();
    await expect(page.getByRole('button', { name: 'تصحيح الاتجاه' })).toBeHidden();
    const first = await body.evaluate((el: HTMLTextAreaElement) => el.value.codePointAt(0));
    expect(first).toBe(0x200f);
    // The textarea now renders the line right-to-left, like the prompter.
    const direction = await body.evaluate((el: HTMLTextAreaElement) => {
      const probe = document.createElement('div');
      probe.style.unicodeBidi = 'plaintext';
      probe.textContent = el.value;
      document.body.append(probe);
      const range = document.createRange();
      range.selectNodeContents(probe);
      const rect = range.getBoundingClientRect();
      const box = probe.getBoundingClientRect();
      probe.remove();
      return box.right - rect.right < rect.left - box.left ? 'rtl' : 'ltr';
    });
    expect(direction).toBe('rtl');
  });

  test('shows word, section and pause counts', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.getByRole('textbox', { name: 'النص' }).fill('# مقدمة\n\nكلمة ثانية ثالثة [توقف]');
    const stats = page.getByTestId('editor-stats');
    await expect(stats).toContainText('3 كلمات');
    await expect(stats).toContainText('قسم واحد');
    await expect(stats).toContainText('وقفة واحدة');
  });

  test('shows every blank line of the script as an empty line', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.getByRole('textbox', { name: 'النص' }).fill('سطر أول\nسطر تاني\n\nفكرة جديدة\n\n\nفكرة تالتة');
    const preview = page.getByTestId('preview');
    if (!(await preview.isVisible())) await page.getByRole('button', { name: 'إظهار المعاينة' }).click();
    await expect(preview.locator('[data-kind="para"]')).toHaveCount(3);

    const gaps = await preview.evaluate((root) => {
      const blocks = [...root.querySelectorAll<HTMLElement>('[data-kind="para"]')];
      const line = parseFloat(getComputedStyle(blocks[0]!.querySelector('div')!).lineHeight);
      return blocks.slice(1).map((block, i) => {
        const previous = blocks[i]!.getBoundingClientRect();
        return (block.getBoundingClientRect().top - previous.bottom) / line;
      });
    });
    expect(gaps[0]).toBeCloseTo(1, 1);
    expect(gaps[1]).toBeCloseTo(2, 1);
  });
});
