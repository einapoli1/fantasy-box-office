import MovieCard from './MovieCard';

interface Props {
  roster: any[];
  onMovieClick?: (movieId: number) => void;
}

export default function RosterList({ roster, onMovieClick }: Props) {
  if (!roster.length) return <p className="empty">No movies on roster</p>;
  return (
    <div className="roster-list">
      {roster.map((r) => (
        <MovieCard
          key={r.id}
          movie={r.movie}
          onClick={() => onMovieClick?.(r.movie_id)}
        />
      ))}
    </div>
  );
}
