import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, MovieProjection } from '../lib/api';
import ShareButton from '../components/ShareButton';
import Skeleton from '../components/Skeleton';

export default function MovieDetail() {
  const { id } = useParams();
  const [movie, setMovie] = useState<any>(null);
  const [projections, setProjections] = useState<MovieProjection | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const mid = parseInt(id!);
    api.getMovie(mid).then(setMovie).catch(e => setError(e.message));
    api.getMovieProjections(mid).then(setProjections).catch(() => {});
  }, [id]);

  if (error) return (
    <div className="movie-detail">
      <div className="error-state">
        <p>Failed to load movie: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  if (!movie) return <div className="movie-detail"><Skeleton lines={8} /></div>;

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

          <ShareButton
            title={`${movie.title} - Fantasy Box Office`}
            text={`Check out ${movie.title} on Fantasy Box Office!`}
          />

          {/* Projections */}
          {projections && (
            <div className="projections-section">
              <h3>📊 Projected Points</h3>
              <div className="projection-total">
                <span className="proj-big">{projections.projected_points.toFixed(1)}</span>
                <span className="proj-label">projected pts</span>
              </div>
              <div className="draft-value-badge">
                Draft Value: <strong>{projections.draft_value.toFixed(2)}x</strong>
              </div>

              <div className="projection-bars">
                <ProjectionBar label="Opening Weekend" value={projections.opening_weekend_est} max={Math.max(projections.opening_weekend_est, projections.domestic_est, projections.worldwide_est)} />
                <ProjectionBar label="Domestic Total" value={projections.domestic_est} max={Math.max(projections.opening_weekend_est, projections.domestic_est, projections.worldwide_est)} />
                <ProjectionBar label="Worldwide Total" value={projections.worldwide_est} max={Math.max(projections.opening_weekend_est, projections.domestic_est, projections.worldwide_est)} />
              </div>

              {projections.bonus_chances.length > 0 && (
                <div className="bonus-chances">
                  <h4>Bonus Chances</h4>
                  {projections.bonus_chances.map(b => (
                    <div key={b.name} className="bonus-item">
                      <span>{b.name}</span>
                      <span className="bonus-prob">{(b.probability * 100).toFixed(0)}% chance</span>
                      <span className="bonus-pts">+{b.points} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

function ProjectionBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const fmt = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${n.toLocaleString()}`;
  return (
    <div className="projection-bar-row">
      <span className="proj-bar-label">{label}</span>
      <div className="proj-bar-track">
        <div className="proj-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="proj-bar-value">{fmt(value)}</span>
    </div>
  );
}
