import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function importFile(page: Page, name: string) {
  await page.goto('./');
  await page.getByTestId('script-card').first().waitFor();
  await page.getByTestId('import-input').setInputFiles(fixture(name));
  await expect(page.getByTestId('script-card')).toHaveCount(4);
}

async function openEditor(page: Page, title: string) {
  await page.getByRole('link', { name: title, exact: true }).click();
  return page.getByRole('textbox', { name: /^(Script|النص)$/ });
}

test.describe('import and export', () => {
  test.use({ locale: 'ar-EG' });

  test('reads legacy Windows-1256 Arabic text files', async ({ page }) => {
    await importFile(page, 'cp1256.txt');
    await expect(page.getByText(/Windows-1256/)).toBeVisible();
    const body = await openEditor(page, 'cp1256');
    await expect(body).toHaveValue('مرحباً بكم في الملقّن\nهذا ملف بترميز عربي قديم.');
  });

  test('converts Markdown', async ({ page }) => {
    await importFile(page, 'sample.md');
    const body = await openEditor(page, 'sample');
    await expect(body).toHaveValue('# العنوان\n\nنص **عريض** مع رابط.\n\n• بند أول\n• بند ثانٍ');
  });

  test('converts Word documents with headings and bold text', async ({ page }) => {
    await importFile(page, 'sample.docx');
    const body = await openEditor(page, 'sample');
    await expect(body).toHaveValue('# المقدمة\n\n**مرحباً** بكم في الحلقة.');
  });

  test('backs up and restores scripts', async ({ page }) => {
    await page.goto('./#/settings/storage');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'تنزيل نسخة احتياطية' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^teleprompter-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const backup = JSON.parse(readFileSync(path, 'utf8')) as { scripts: unknown[] };
    expect(backup.scripts).toHaveLength(3);

    await page.getByTestId('restore-input').setInputFiles(path);
    await expect(page.getByText('استُعيدت 3 نصوص')).toBeVisible();
    await page.goto('./');
    await expect(page.getByTestId('script-card')).toHaveCount(6);
  });

  test('exports a script as text', async ({ page }) => {
    await page.goto('./');
    const card = page.getByTestId('script-card').first();
    await card.waitFor();
    const downloadPromise = page.waitForEvent('download');
    await card.getByRole('button', { name: 'تصدير' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('مرحباً بك في الملقّن.txt');
    expect(readFileSync(await download.path(), 'utf8')).toContain('# المقدمة');
  });
});

test.describe('editor tools', () => {
  test.use({ locale: 'ar-EG' });

  test('pastes rich text as markup and fixes PDF presentation forms', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('script-card').first().waitFor();
    await page.getByRole('button', { name: 'نص جديد' }).click();
    const body = page.getByRole('textbox', { name: 'النص' });
    await body.focus();
    await body.evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/html', '<h2>عنوان</h2><p><b>نص</b> عادي</p>');
      data.setData('text/plain', 'عنوان\nنص عادي');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(body).toHaveValue('## عنوان\n\n**نص** عادي');

    // Text copied from a PDF often arrives as presentation-form glyphs.
    const forms = String.fromCodePoint(0xfee3, 0xfeae, 0xfea3, 0xfe92, 0xfe8e);
    await body.fill(forms);
    await page.getByRole('button', { name: 'أدوات النص' }).click();
    await page.getByRole('menuitem', { name: 'إصلاح الحروف العربية المنسوخة من PDF' }).click();
    await expect(body).toHaveValue('مرحبا');
    await body.focus();
    await page.keyboard.press('Control+z');
    await expect(body).toHaveValue(forms);
  });
});
