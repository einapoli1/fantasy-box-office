import { type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:8090/api';

let userCounter = 0;

export function uniqueEmail(): string {
  return `test-${Date.now()}-${++userCounter}@example.com`;
}

export async function registerUser(page: Page, email: string, displayName: string, password: string) {
  await page.goto('/login');
  // Switch to register mode
  await page.click('button.link-btn:has-text("Register")');
  await page.fill('input[placeholder="Display Name"]', displayName);
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function createLeague(page: Page, name: string) {
  await page.goto('/dashboard');
  await page.click('button:has-text("Create League")');
  await page.fill('input[placeholder="League Name"]', name);
  await page.fill('input[placeholder="Your Team Name"]', 'My Team');
  await page.click('.modal button[type="submit"]');
  await page.waitForURL('**/league/**', { timeout: 10000 });
}

export async function apiRegister(
  request: APIRequestContext,
  email: string,
  displayName: string,
  password: string
): Promise<{ token: string; user: any }> {
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { email, password, display_name: displayName },
  });
  if (!res.ok()) throw new Error(`Register failed: ${res.status()}`);
  return res.json();
}

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const data = await res.json();
  return data.token;
}

export async function apiCreateLeague(
  request: APIRequestContext,
  token: string,
  name: string
): Promise<any> {
  const res = await request.post(`${API_BASE}/leagues`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, season_year: 2025, max_teams: 8, team_name: 'My Team' },
  });
  if (!res.ok()) throw new Error(`Create league failed: ${res.status()}`);
  return res.json();
}

/** Inject auth state into browser so page loads as logged-in user */
export async function loginViaAPI(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string
) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  const data = await res.json();
  await page.goto('/');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: data.token, user: data.user });
}
