import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function JoinLeague() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setJoining(true);
    setError('');
    try {
      const result = await api.joinLeagueByCode(code, teamName);
      navigate(`/league/${result.league_id || result.id}`);
    } catch (err: any) {
      setError(err.message);
    }
    setJoining(false);
  };

  if (!user) {
    return (
      <div className="join-league">
        <h1>Join League</h1>
        <p>You need to sign in to join a league.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign In</button>
      </div>
    );
  }

  return (
    <div className="join-league">
      <h1>🎬 Join League</h1>
      <p>You've been invited! Enter your team name to join.</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleJoin}>
        <input
          type="text"
          placeholder="Your Team Name"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={joining}>
          {joining ? 'Joining...' : 'Join League'}
        </button>
      </form>
    </div>
  );
}
