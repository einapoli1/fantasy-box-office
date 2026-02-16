import { test, expect } from '@playwright/test';
import { registerUser, loginUser, uniqueEmail, apiRegister } from './helpers';

test.describe('Authentication', () => {
  const password = 'TestPass123!';

  test('register new account redirects to dashboard', async ({ page }) => {
    const email = uniqueEmail();
    await registerUser(page, email, 'New User', password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('login with valid credentials shows dashboard', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Login Test', password);
    await loginUser(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login with wrong password shows error', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'Wrong Pass', password);
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', 'WrongPassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toBeVisible();
  });

  test('logout returns to landing', async ({ page }) => {
    const email = uniqueEmail();
    await registerUser(page, email, 'Logout Test', password);
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL('/');
  });

  test('register with existing email shows error', async ({ page, request }) => {
    const email = uniqueEmail();
    await apiRegister(request, email, 'First User', password);
    await page.goto('/login');
    await page.click('button.link-btn:has-text("Register")');
    await page.fill('input[placeholder="Display Name"]', 'Duplicate');
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toBeVisible();
  });
});
