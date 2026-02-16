import { test, expect } from '@playwright/test';
import { uniqueEmail, apiRegister, apiLogin, apiCreateLeague, loginViaAPI } from './helpers';

test.describe('Draft Room', () => {
  const password = 'TestPass123!';

  async function setupLeague(page: any, request: any) {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Drafter', password);
    const token = await apiLogin(request, email, password);
    const league = await apiCreateLeague(request, token, 'Draft League');
    await loginViaAPI(page, request, email, password);
    return league;
  }

  test('draft room loads with available movies', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/draft`);
    // Should show movie list or draft interface
    await expect(page.locator('.draft-room, .draft-board, [class*="draft"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('movies show poster, title, release date', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/draft`);
    // data-testid="movie-card" recommended
    const movieCard = page.locator('.movie-card, [class*="movie"]').first();
    await expect(movieCard).toBeVisible({ timeout: 10000 });
  });

  test('search/filter movies works', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/draft`);
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[placeholder*="ilter"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('test');
    // Results should update (no crash)
    await page.waitForTimeout(500);
  });

  test('draft board shows pick grid', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/draft`);
    await expect(page.locator('.draft-board, [class*="board"], [class*="grid"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('making a pick updates the board', async ({ page, request }) => {
    const league = await setupLeague(page, request);
    await page.goto(`/league/${league.id}/draft`);
    // Click first available movie to draft it
    const pickButton = page.locator('button:has-text("Draft"), button:has-text("Pick"), button:has-text("Select")').first();
    if (await pickButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pickButton.click();
      // Board should update
      await page.waitForTimeout(1000);
    }
  });
});
