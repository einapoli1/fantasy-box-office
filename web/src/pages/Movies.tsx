import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  release_date: string;
  poster_url: string;
  budget: number;
  domestic_gross: number;
  worldwide_gross: number;
  rt_score: number;
  status: string;
  points: number;
  projected_points: number;
}

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'released'>('upcoming');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getMovies(filter === 'all' ? undefined : { status: filter })
      .then((data: Movie[]) => setMovies(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = movies.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatMoney = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n > 0) return `$${(n / 1e3).toFixed(0)}K`;
    return '—';
  };

  return (
    <div className="movies-page" style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ color: '#f0e68c', marginBottom: '0.5rem' }}>🎬 Movie Database</h1>
      <p style={{ color: '#999', marginBottom: '1.5rem' }}>Browse all movies available for drafting</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '0.75rem 1rem',
            background: '#1a1a2e', border: '1px solid #333', borderRadius: 8,
            color: '#fff', fontSize: '1rem'
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'upcoming', 'released'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.75rem 1.25rem', borderRadius: 8, border: 'none',
                background: filter === f ? '#f0e68c' : '#1a1a2e',
                color: filter === f ? '#0a0a1a' : '#ccc',
                fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >{f}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '3rem' }}>Loading movies...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '3rem' }}>No movies found.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1.5rem'
        }}>
          {filtered.map(movie => (
            <Link
              key={movie.id}
              to={`/movie/${movie.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: '#16213e',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                border: '1px solid #1a1a3e',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(240,230,140,0.15)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
              }}
              >
                <div style={{ position: 'relative', paddingTop: '150%', background: '#0a0a1a' }}>
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%', objectFit: 'cover'
                      }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : null}
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: movie.status === 'upcoming' ? '#f0e68c' : '#4ade80',
                    color: '#0a0a1a', padding: '2px 8px', borderRadius: 4,
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase'
                  }}>
                    {movie.status}
                  </div>
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <h3 style={{
                    color: '#fff', fontSize: '0.95rem', margin: '0 0 0.25rem',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>{movie.title}</h3>
                  <p style={{ color: '#999', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                    {movie.release_date ? new Date(movie.release_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: '#999' }}>Budget: {formatMoney(movie.budget)}</span>
                    <span style={{ color: '#f0e68c', fontWeight: 700 }}>
                      {movie.points > 0 ? `${movie.points.toFixed(1)} pts` : movie.projected_points > 0 ? `~${movie.projected_points.toFixed(0)} pts` : ''}
                    </span>
                  </div>
                  {movie.worldwide_gross > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '0.25rem' }}>
                      WW Gross: {formatMoney(movie.worldwide_gross)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
