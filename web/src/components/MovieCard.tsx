interface Props {
  movie: any;
  onClick?: () => void;
  action?: React.ReactNode;
}

export default function MovieCard({ movie, onClick, action }: Props) {
  const posterFallback = 'https://via.placeholder.com/200x300/1a1a2e/e0d68a?text=' + encodeURIComponent(movie.title);
  return (
    <div className="movie-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <img
        src={movie.poster_url || posterFallback}
        alt={movie.title}
        onError={(e) => { (e.target as HTMLImageElement).src = posterFallback; }}
      />
      <div className="movie-card-info">
        <h4>{movie.title}</h4>
        <span className="date">{movie.release_date || 'TBA'}</span>
        {movie.domestic_gross > 0 && (
          <span className="gross">${(movie.domestic_gross / 1e6).toFixed(1)}M domestic</span>
        )}
        {movie.rt_score > 0 && (
          <span className={`rt ${movie.rt_score >= 75 ? 'fresh' : 'rotten'}`}>🍅 {movie.rt_score}%</span>
        )}
        <span className={`status-badge ${movie.status}`}>{movie.status}</span>
        {action && <div className="movie-card-action">{action}</div>}
      </div>
    </div>
  );
}
