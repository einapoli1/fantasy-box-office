import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function MovieDetail() {
  const { id } = useParams();
  const [movie, setMovie] = useState<any>(null);

  useEffect(() => {
    api.getMovie(parseInt(id!)).then(setMovie);
  }, [id]);

  if (!movie) return <div className="loading">Loading...</div>;

  const fmt = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;

  return (
    <div className="movie-detail">
      <div className="movie-detail-header">
        <img
          src={movie.poster_url || `https://via.placeholder.com/300x450/1a1a2e/e0d68a?text=${encodeURIComponent(movie.title)}`}
          alt={movie.title}
          onError={(e) => { (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x450/1a1a2e/e0d68a?text=${encodeURIComponent(movie.title)}`; }}
        />
        <div className="movie-detail-info">
          <h1>{movie.title}</h1>
          <span className={`status-badge ${movie.status}`}>{movie.status}</span>
          <div className="movie-meta">
            <div><strong>Release Date:</strong> {movie.release_date || 'TBA'}</div>
            {movie.budget > 0 && <div><strong>Budget:</strong> {fmt(movie.budget)}</div>}
            {movie.domestic_gross > 0 && <div><strong>Domestic Gross:</strong> {fmt(movie.domestic_gross)}</div>}
            {movie.worldwide_gross > 0 && <div><strong>Worldwide Gross:</strong> {fmt(movie.worldwide_gross)}</div>}
            {movie.rt_score > 0 && (
              <div><strong>Rotten Tomatoes:</strong> <span className={movie.rt_score >= 75 ? 'fresh' : 'rotten'}>🍅 {movie.rt_score}%</span></div>
            )}
          </div>

          <div className="scoring-breakdown">
            <h3>Scoring Breakdown</h3>
            <table>
              <tbody>
                <tr><td>Domestic Gross</td><td>{(movie.domestic_gross / 1e6 * 0.5).toFixed(1)} pts</td></tr>
                <tr><td>Worldwide Gross</td><td>{(movie.worldwide_gross / 1e6 * 0.25).toFixed(1)} pts</td></tr>
                {movie.rt_score >= 75 && <tr><td>RT Fresh Bonus</td><td>+10 pts</td></tr>}
                {movie.domestic_gross >= 100e6 && <tr><td>$100M+ Domestic</td><td>+20 pts</td></tr>}
                {movie.worldwide_gross >= 500e6 && <tr><td>$500M+ Worldwide</td><td>+50 pts</td></tr>}
                {movie.budget > 0 && movie.budget > 2 * movie.worldwide_gross && (
                  <tr className="penalty"><td>Flop Penalty</td><td>-10 pts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
