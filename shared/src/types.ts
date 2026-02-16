export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
}

export type LeagueStatus = 'pending' | 'drafting' | 'active' | 'completed';

export interface League {
  id: number;
  name: string;
  owner_id: number;
  season_year: number;
  draft_date: string;
  max_teams: number;
  status: LeagueStatus;
}

export interface Team {
  id: number;
  league_id: number;
  user_id: number;
  name: string;
  total_points: number;
}

export type MovieStatus = 'upcoming' | 'released' | 'free_agent';

export interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  release_date: string;
  poster_url: string;
  budget: number;
  domestic_gross: number;
  worldwide_gross: number;
  rt_score: number;
  status: MovieStatus;
}

export type AcquisitionType = 'draft' | 'waiver' | 'trade';

export interface RosterEntry {
  id: number;
  team_id: number;
  movie_id: number;
  acquired_at: string;
  acquisition_type: AcquisitionType;
  movie?: Movie;
}

export interface DraftPick {
  id: number;
  league_id: number;
  round: number;
  pick_number: number;
  team_id: number;
  movie_id: number;
  movie?: Movie;
  team?: Team;
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected';

export interface Trade {
  id: number;
  league_id: number;
  proposer_team_id: number;
  receiver_team_id: number;
  status: TradeStatus;
  proposed_at: string;
  items?: TradeItem[];
}

export interface TradeItem {
  id: number;
  trade_id: number;
  team_id: number;
  movie_id: number;
  movie?: Movie;
}

export interface WaiverClaim {
  id: number;
  league_id: number;
  team_id: number;
  movie_id: number;
  priority: number;
  status: string;
  claimed_at: string;
  movie?: Movie;
}

export type TransactionType = 'draft' | 'waiver' | 'trade' | 'drop';

export interface Transaction {
  id: number;
  league_id: number;
  team_id: number;
  movie_id: number;
  type: TransactionType;
  created_at: string;
  movie?: Movie;
  team?: Team;
}

export interface DraftState {
  league_id: number;
  status: 'waiting' | 'active' | 'completed';
  current_round: number;
  current_pick: number;
  current_team_id: number;
  pick_deadline: string;
  picks: DraftPick[];
  teams: Team[];
}

export interface Standing {
  team: Team;
  user: User;
  rank: number;
  total_points: number;
  roster_size: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}
