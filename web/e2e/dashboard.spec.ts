import { test, expect } from '@playwright/test';
import { registerUser, uniqueEmail, createLeague } from './helpers';

test.describe('Dashboard', () => {
  const password = 'TestPass123!';

  test('shows empty state when no leagues', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'Empty Dash', password);
    await expect(page.locator('.empty')).toContainText('No leagues yet');
  });

  test('shows league cards after creating one', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'League Creator', password);
    await createLeague(page, 'Test League');
    await page.goto('/dashboard');
    // data-testid="league-card" recommended
    await expect(page.locator('.leagues-grid').locator('> *')).toHaveCount(1);
  });

  test('create league button opens form', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'Modal Test', password);
    await page.click('button:has-text("Create League")');
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('input[placeholder="League Name"]')).toBeVisible();
  });

  test('league card links to league view', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'Card Click', password);
    await createLeague(page, 'Clickable League');
    await page.goto('/dashboard');
    await page.click('.leagues-grid > *:first-child');
    await expect(page).toHaveURL(/\/league\/\d+/);
  });
});
