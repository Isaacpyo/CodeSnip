import { expect, test, type Page } from '@playwright/test';

/**
 * Main flow smoke test. Runs unchanged against the mock backend and against a
 * real Supabase stack (E2E_BACKEND=supabase), so it only relies on seed data.
 */

const ADA_PRIVATE_SNIPPET = '/s/5a1e0002-0000-4000-8000-000000000005';

async function startDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'My snippets' })).toBeVisible();
}

async function typeInMonaco(page: Page, text: string) {
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.type(text);
}

test('demo user can search, create, share and copy a snippet; visitors see only public ones', async ({
  page,
  context,
}) => {
  const title = `E2E snippet ${Date.now()}`;

  // 1. One-click demo login lands in a seeded library.
  await startDemo(page);
  await expect(page.getByText('useDebounce hook')).toBeVisible();
  await expect(page.getByTestId('result-count')).toHaveText(/\d+ snippets/);

  // 2. Full-text search (prefix match) narrows the list.
  const search = page.getByRole('searchbox', { name: 'Search snippets' });
  await search.fill('debou');
  await expect(page.getByTestId('result-count')).toHaveText('1 snippet');
  await expect(page).toHaveURL(/\?q=debou/);
  await search.fill('');

  // 3. Tag filter from the sidebar.
  await page
    .getByRole('navigation', { name: 'Filters' })
    .getByRole('button', { name: /^#git \d+$/ })
    .click();
  await expect(page.getByTestId('result-count')).toHaveText('1 snippet');
  await expect(page.getByText('Delete merged git branches')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();

  // 4. Create a snippet in the Monaco editor.
  await page.getByRole('link', { name: 'New snippet' }).last().click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('Created by the Playwright smoke test');
  await page.getByLabel('Language').selectOption('python');
  await page.getByLabel('Tags').fill('e2e, smoke,');
  await typeInMonaco(page, 'print("hello from e2e")');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page).toHaveURL(/\/app\/snippets\/[0-9a-f-]{36}$/);
  await expect(page.getByText('All changes saved')).toBeVisible();
  const snippetPath = new URL(page.url()).pathname;
  const id = snippetPath.split('/').pop()!;

  // 5. Copy to clipboard.
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByText('Copied to clipboard').first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('print("hello from e2e")');

  // 6. Make it public through the share dialog and copy the link.
  await page.getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share snippet' });
  await dialog.getByRole('button', { name: 'Make public' }).click();
  await expect(dialog.getByLabel('Share link')).toHaveValue(new RegExp(`/s/${id}$`));
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/s/${id}$`),
  );
  await dialog.getByRole('button', { name: 'Close' }).click();

  // 7. It shows up in the library search.
  await page.getByRole('link', { name: 'My snippets' }).first().click();
  await page.getByRole('searchbox', { name: 'Search snippets' }).fill(title);
  await expect(page.getByTestId('result-count')).toHaveText('1 snippet');

  // 8. Sign out: the public share link works for anonymous visitors...
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/s/${id}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.locator('.monaco-editor').first()).toContainText('hello from e2e');
  await expect(page.getByRole('link', { name: /sign in to save a copy/i })).toBeVisible();

  // ...while someone else's private snippet is not visible at all (RLS).
  await page.goto(ADA_PRIVATE_SNIPPET);
  await expect(page.getByRole('heading', { name: 'Snippet not found' })).toBeVisible();

  // 9. Clean up: sign back in and delete it.
  await context.clearPermissions();
  await startDemo(page);
  await page.goto(snippetPath);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Snippet deleted').first()).toBeVisible();
  await page.goto(`/s/${id}`);
  await expect(page.getByRole('heading', { name: 'Snippet not found' })).toBeVisible();
});

test('export and re-import a library as JSON', async ({ page }) => {
  await startDemo(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^codesnip-export-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(
    await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()),
  );
  expect(exported.format).toBe('codesnip');
  expect(exported.snippets.map((s: { title: string }) => s.title)).toContain('useDebounce hook');

  const title = `Imported ${Date.now()}`;
  await page.getByRole('button', { name: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import snippets' });
  await dialog.getByTestId('import-file-input').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { title, code: 'echo imported', language: 'shell', tags: ['e2e'] },
        { title: '' },
      ]),
    ),
  });
  await expect(dialog.getByText('1 snippet ready to import, 1 will be skipped')).toBeVisible();
  await dialog.getByRole('button', { name: 'Import 1 snippet' }).click();
  await expect(page.getByText('Imported 1 snippet').first()).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search snippets' }).fill(title);
  await expect(page.getByTestId('result-count')).toHaveText('1 snippet');

  // Clean up.
  await page.getByText(title).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/app$/);
});
