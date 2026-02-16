const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8090/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  // Auth
  register: (email: string, password: string, display_name: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, display_name }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  // Leagues
  getLeagues: () => request<any[]>('/leagues'),
  createLeague: (data: any) => request<any>('/leagues', { method: 'POST', body: JSON.stringify(data) }),
  getLeague: (id: number) => request<any>(`/leagues/${id}`),
  joinLeague: (id: number, team_name: string) =>
    request<any>(`/leagues/${id}/join`, { method: 'POST', body: JSON.stringify({ team_name }) }),
  getStandings: (id: number) => request<any[]>(`/leagues/${id}/standings`),
  getTransactions: (id: number) => request<any[]>(`/leagues/${id}/transactions`),

  // Draft
  startDraft: (leagueId: number) => request<any>(`/leagues/${leagueId}/draft/start`, { method: 'POST' }),
  makePick: (leagueId: number, movie_id: number) =>
    request<any>(`/leagues/${leagueId}/draft/pick`, { method: 'POST', body: JSON.stringify({ movie_id }) }),
  getDraftStatus: (leagueId: number) => request<any>(`/leagues/${leagueId}/draft/status`),

  // Teams
  getTeam: (id: number) => request<any>(`/teams/${id}`),
  getTeamRoster: (id: number) => request<any[]>(`/teams/${id}/roster`),

  // Movies
  getMovies: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<any[]>(`/movies${qs ? '?' + qs : ''}`);
  },
  getMovie: (id: number) => request<any>(`/movies/${id}`),

  // Trades
  createTrade: (data: any) => request<any>('/trades', { method: 'POST', body: JSON.stringify(data) }),
  acceptTrade: (id: number) => request<any>(`/trades/${id}/accept`, { method: 'PUT' }),
  rejectTrade: (id: number) => request<any>(`/trades/${id}/reject`, { method: 'PUT' }),

  // Waivers
  claimWaiver: (data: any) => request<any>('/waivers/claim', { method: 'POST', body: JSON.stringify(data) }),
  getLeagueWaivers: (id: number) => request<any[]>(`/leagues/${id}/waivers`),
};
