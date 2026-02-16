import { Movie } from './types';

export interface ScoreBreakdown {
  openingWeekend: number;
  domesticGross: number;
  worldwideGross: number;
  rtBonus: number;
  numberOneBonus: number;
  domestic100m: number;
  worldwide500m: number;
  flopPenalty: number;
  total: number;
}

export function calculateMovieScore(
  movie: Movie,
  isNumberOneOpening: boolean = false,
  openingWeekendGross: number = 0
): ScoreBreakdown {
  const openingWeekend = openingWeekendGross / 1_000_000;
  const domesticGross = (movie.domestic_gross / 1_000_000) * 0.5;
  const worldwideGross = (movie.worldwide_gross / 1_000_000) * 0.25;
  const rtBonus = movie.rt_score >= 75 ? 10 : 0;
  const numberOneBonus = isNumberOneOpening ? 15 : 0;
  const domestic100m = movie.domestic_gross >= 100_000_000 ? 20 : 0;
  const worldwide500m = movie.worldwide_gross >= 500_000_000 ? 50 : 0;
  const flopPenalty =
    movie.budget > 0 && movie.budget > 2 * movie.worldwide_gross ? -10 : 0;

  const total =
    openingWeekend +
    domesticGross +
    worldwideGross +
    rtBonus +
    numberOneBonus +
    domestic100m +
    worldwide500m +
    flopPenalty;

  return {
    openingWeekend: Math.round(openingWeekend * 100) / 100,
    domesticGross: Math.round(domesticGross * 100) / 100,
    worldwideGross: Math.round(worldwideGross * 100) / 100,
    rtBonus,
    numberOneBonus,
    domestic100m,
    worldwide500m,
    flopPenalty,
    total: Math.round(total * 100) / 100,
  };
}

export function formatPoints(points: number): string {
  return points.toFixed(1);
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}
