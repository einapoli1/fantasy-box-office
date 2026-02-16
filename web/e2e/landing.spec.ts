import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows hero section with title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Fantasy Box Office');
    await expect(page.locator('.tagline')).toBeVisible();
  });

  test('shows how it works section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=How It Works')).toBeVisible();
    await expect(page.locator('.step')).toHaveCount(4);
  });

  test('CTA buttons navigate to login', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Get Started")');
    await expect(page).toHaveURL(/\/login/);
  });

  test('responsive layout at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Fantasy Box Office');
    await expect(page.locator('.hero')).toBeVisible();
  });
});
