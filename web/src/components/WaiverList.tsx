import MovieCard from './MovieCard';

interface Props {
  movies: any[];
  onClaim?: (movieId: number) => void;
}

export default function WaiverList({ movies, onClaim }: Props) {
  if (!movies.length) return <p className="empty">No free agent movies available</p>;
  return (
    <div className="waiver-list">
      {movies.map((m) => (
        <MovieCard
          key={m.id}
          movie={m}
          action={onClaim && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onClaim(m.id); }}>Claim</button>}
        />
      ))}
    </div>
  );
}
