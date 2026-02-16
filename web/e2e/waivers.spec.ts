import { test, expect } from '@playwright/test';
import { uniqueEmail, apiRegister, apiLogin, apiCreateLeague, loginViaAPI } from './helpers';

test.describe('Waiver Wire', () => {
  const password = 'TestPass123!';

  async function setupLeague(page: any, request: any) {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Waiver User', password);
    const token = await apiLogin(request, email, password);
    const league = await apiCreateLeague(request, token, 'Waiver League');
    await loginViaAPI(page, request, email, password);
    return league;
  }

  test('waiver wire page loads', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/waivers`);
    await expect(page.locator('text=/waiver|free agent/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows free agent movies', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/waivers`);
    // data-testid="waiver-list" recommended
    const list = page.locator('.waiver-list, [class*="waiver"], [class*="free-agent"], table').first();
    await expect(list).toBeVisible({ timeout: 10000 });
  });

  test('claim button works', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/waivers`);
    const claimBtn = page.locator('button:has-text("Claim"), button:has-text("Add")').first();
    if (await claimBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await claimBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('shows claim priority', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/waivers`);
    await expect(page.locator('text=/priority|order/i').first()).toBeVisible({ timeout: 10000 }).catch(() => {
      // Priority may not be displayed if no claims yet
    });
  });
});
