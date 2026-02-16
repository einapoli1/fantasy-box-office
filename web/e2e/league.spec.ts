import { test, expect } from '@playwright/test';
import { registerUser, uniqueEmail, createLeague, apiRegister, apiLogin, apiCreateLeague, loginViaAPI } from './helpers';

test.describe('League Management', () => {
  const password = 'TestPass123!';

  test('create a league with custom name', async ({ page }) => {
    await registerUser(page, uniqueEmail(), 'League Owner', password);
    await createLeague(page, 'Blockbuster League');
    await expect(page).toHaveURL(/\/league\/\d+/);
    await expect(page.locator('text=Blockbuster League')).toBeVisible();
  });

  test('join league via invite code', async ({ page, request }) => {
    // Create a league via API with one user
    const ownerEmail = uniqueEmail();
    await apiRegister(request, ownerEmail, 'Owner', password);
    const token = await apiLogin(request, ownerEmail, password);
    const league = await apiCreateLeague(request, token, 'Join Test League');

    // Register a second user via UI and join
    await registerUser(page, uniqueEmail(), 'Joiner', password);
    await page.goto('/dashboard');
    await page.click('button:has-text("Join League")');
    await page.fill('input[placeholder="League ID"]', String(league.id));
    await page.fill('input[placeholder="Your Team Name"]', 'Joiner Team');
    await page.click('.modal button[type="submit"]');
    // Should refresh leagues list
    await expect(page.locator('.leagues-grid').locator('> *')).toHaveCount(1, { timeout: 5000 });
  });

  test('league view shows standings table', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Standings Viewer', password);
    const token = await apiLogin(request, email, password);
    const league = await apiCreateLeague(request, token, 'Standings League');
    await loginViaAPI(page, request, email, password);
    await page.goto(`/league/${league.id}`);
    // data-testid="standings-table" recommended
    await expect(page.locator('table, .standings, [class*="standings"]')).toBeVisible({ timeout: 10000 });
  });

  test('league view shows roster browser', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Roster Viewer', password);
    const token = await apiLogin(request, email, password);
    const league = await apiCreateLeague(request, token, 'Roster League');
    await loginViaAPI(page, request, email, password);
    await page.goto(`/league/${league.id}`);
    await expect(page.locator('text=Roster').first()).toBeVisible({ timeout: 10000 });
  });

  test('league view shows transaction feed', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'TX Viewer', password);
    const token = await apiLogin(request, email, password);
    const league = await apiCreateLeague(request, token, 'TX League');
    await loginViaAPI(page, request, email, password);
    await page.goto(`/league/${league.id}`);
    await expect(page.locator('text=Transaction').first()).toBeVisible({ timeout: 10000 });
  });
});
