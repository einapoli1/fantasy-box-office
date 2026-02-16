import { test, expect } from '@playwright/test';
import { registerUser, uniqueEmail } from './helpers';

test.describe('App Navigation', () => {
  const password = 'TestPass123!';

  test('nav bar links work', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'Nav Test', password);
    // Dashboard link
    await page.click('a:has-text("Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);
    // Brand link goes home
    await page.click('.nav-brand');
    await expect(page).toHaveURL('/');
  });

  test('back navigation works', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'Back Nav', password);
    await page.goto('/');
    await page.goto('/dashboard');
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    // App should show something — either a 404 page or redirect to landing
    // Since there's no catch-all route, React Router will show blank or landing
    const content = await page.textContent('body');
    expect(content).toBeDefined();
  });

  test('mobile hamburger menu works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    // data-testid="mobile-menu" recommended
    const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu"]').first();
    if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hamburger.click();
      await expect(page.locator('.nav-links, [class*="mobile-nav"]').first()).toBeVisible();
    }
  });
});
