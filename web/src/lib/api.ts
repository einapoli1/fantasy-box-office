const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

export function getWsUrl(path: string): string {
  const token = getToken();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  const url = `${proto}//${host}${path}`;
  return token ? `${url}?token=${token}` : url;
}

export interface AppNotification {
  id: number;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  user_id: number;
  display_name: string;
  avatar?: string;
  message: string;
  created_at: string;
}

export interface TradeAnalysis {
  give_points: number;
  receive_points: number;
  difference: number;
  rating: 'favorable' | 'unfavorable' | 'even';
  recommendation: string;
}

export interface MovieProjection {
  opening_weekend_est: number;
  domestic_est: number;
  worldwide_est: number;
  bonus_chances: { name: string; probability: number; points: number }[];
  projected_points: number;
  draft_value: number;
}

export interface SeasonRecord {
  type: string;
  label: string;
  value: string;
  holder: string;
}

export interface SeasonWinner {
  season_year: number;
  team_name: string;
  owner: string;
  total_points: number;
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
  joinLeagueByCode: (code: string, team_name: string) =>
    request<any>(`/leagues/join/${code}`, { method: 'POST', body: JSON.stringify({ team_name }) }),
  getStandings: (id: number) => request<any[]>(`/leagues/${id}/standings`),
  getTransactions: (id: number) => request<any[]>(`/leagues/${id}/transactions`),
  getChatHistory: (id: number, limit = 50) => request<ChatMessage[]>(`/leagues/${id}/chat?limit=${limit}`),

  // Draft
  startDraft: (leagueId: number) => request<any>(`/leagues/${leagueId}/draft/start`, { method: 'POST' }),
  makePick: (leagueId: number, movie_id: number) =>
    request<any>(`/leagues/${leagueId}/draft/pick`, { method: 'POST', body: JSON.stringify({ movie_id }) }),
  getDraftStatus: (leagueId: number) => request<any>(`/leagues/${leagueId}/draft/status`),

  // Teams
  getTeam: (id: number) => request<any>(`/teams/${id}`),
  getTeamRoster: (id: number) => request<any[]>(`/teams/${id}/roster`),

  // Movies
  getMovies: (params?: { status?: string; search?: string; year?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<any[]>(`/movies${qs ? '?' + qs : ''}`);
  },
  getMovie: (id: number) => request<any>(`/movies/${id}`),
  getMovieProjections: (id: number) => request<MovieProjection>(`/movies/${id}/projections`),

  // Trades
  createTrade: (data: any) => request<any>('/trades', { method: 'POST', body: JSON.stringify(data) }),
  acceptTrade: (id: number) => request<any>(`/trades/${id}/accept`, { method: 'PUT' }),
  rejectTrade: (id: number) => request<any>(`/trades/${id}/reject`, { method: 'PUT' }),
  analyzeTrade: (data: { offer_movie_ids: number[]; request_movie_ids: number[] }) =>
    request<TradeAnalysis>('/trades/analyze', { method: 'POST', body: JSON.stringify(data) }),
  getLeagueTrades: (leagueId: number) => request<any[]>(`/leagues/${leagueId}/trades`),

  // Waivers
  claimWaiver: (data: any) => request<any>('/waivers/claim', { method: 'POST', body: JSON.stringify(data) }),
  getLeagueWaivers: (id: number) => request<any[]>(`/leagues/${id}/waivers`),

  // Notifications
  getNotifications: () => request<AppNotification[]>('/notifications'),
  markNotificationRead: (id: number) => request<any>(`/notifications/${id}/read`, { method: 'PUT' }),

  // Season History
  getSeasonHistory: () => request<{ winners: SeasonWinner[]; records: SeasonRecord[] }>('/seasons/history'),
};
