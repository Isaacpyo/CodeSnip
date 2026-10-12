import { expect, test } from '@playwright/test';

test('works at 375px: no horizontal scroll, filters in a drawer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page.getByText('useDebounce hook')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Show filters' }).click();
  const drawer = page.getByRole('dialog', { name: 'Filters' });
  const python = drawer.getByRole('radio', { name: /Python/ });
  const count = Number((await python.textContent())?.match(/\d+/)?.[0]);
  await python.click();
  await drawer.getByRole('button', { name: 'Show results' }).click();
  await expect(page.getByTestId('result-count')).toHaveText(`${count} snippets`);
  await expect(page).toHaveURL(/lang=python/);
});
