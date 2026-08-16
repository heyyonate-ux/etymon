import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Whence/);
});

test('get started link', async ({ page }) => {
  await page.goto('/');

    // Expects the Start Round button to be visible on the home page.
  await expect(page.getByRole('button', { name: 'Starb Round' })).toBeVisible();
});

test('confirm round start', async ({ page }) => {
  await page.goto('/');

  // // Click the Start round button.
  await page.getByRole('button', { name: 'Start Round' }).click();

  const timer = page.getByTestId('timer-display');

  await page.waitForTimeout(2000); // wait 2 real seconds

  await expect.poll(async () => {
    const text = await timer.textContent(); // e.g. "0:03"
    const [minutes, seconds] = text!.split(':').map(Number);
    return minutes * 60 + seconds; // convert to total seconds
  }, { timeout: 3000 }).toBeGreaterThan(0);
});
