import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import WaiverList from '../components/WaiverList';

export default function WaiverWire() {
  const { id } = useParams();
  const leagueId = parseInt(id!);
  const [movies, setMovies] = useState<any[]>([]);

  useEffect(() => {
    api.getMovies({ status: 'free_agent' }).then(setMovies);
  }, []);

  const handleClaim = async (movieId: number) => {
    try {
      await api.claimWaiver({ league_id: leagueId, movie_id: movieId });
      setMovies(movies.filter(m => m.id !== movieId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="waiver-wire">
      <h1>Waiver Wire</h1>
      <p className="subtitle">Pick up free agent movies to add to your roster.</p>
      <WaiverList movies={movies} onClaim={handleClaim} />
    </div>
  );
}
