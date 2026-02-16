import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import StandingsTable from '../components/StandingsTable';
import TransactionFeed from '../components/TransactionFeed';

export default function LeagueView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [league, setLeague] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<'standings' | 'activity'>('standings');

  const leagueId = parseInt(id!);

  useEffect(() => {
    api.getLeague(leagueId).then(setLeague);
    api.getStandings(leagueId).then(setStandings);
    api.getTransactions(leagueId).then(setTransactions);
  }, [leagueId]);

  if (!league) return <div className="loading">Loading...</div>;

  const isOwner = league.owner_id === user?.id;

  return (
    <div className="league-view">
      <div className="league-header">
        <div>
          <h1>{league.name}</h1>
          <span className={`league-status-lg ${league.status}`}>{league.status}</span>
          <span className="season">{league.season_year} Season</span>
        </div>
        <div className="league-actions">
          {league.status === 'pending' && isOwner && (
            <button className="btn btn-primary" onClick={async () => {
              await api.startDraft(leagueId);
              navigate(`/league/${leagueId}/draft`);
            }}>Start Draft</button>
          )}
          {league.status === 'drafting' && (
            <button className="btn btn-primary" onClick={() => navigate(`/league/${leagueId}/draft`)}>
              Go to Draft
            </button>
          )}
          {league.status === 'active' && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate(`/league/${leagueId}/trades`)}>Trades</button>
              <button className="btn btn-secondary" onClick={() => navigate(`/league/${leagueId}/waivers`)}>Waivers</button>
            </>
          )}
          <span className="league-id">League ID: {league.id}</span>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>Standings</button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Activity</button>
      </div>

      {tab === 'standings' && (
        <StandingsTable standings={standings} onTeamClick={(tid) => navigate(`/team/${tid}`)} />
      )}
      {tab === 'activity' && <TransactionFeed transactions={transactions} />}

      {league.teams && (
        <section className="league-teams">
          <h2>Teams ({league.teams.length}/{league.max_teams})</h2>
          <div className="teams-list">
            {league.teams.map((t: any) => (
              <div key={t.id} className="team-chip" onClick={() => navigate(`/team/${t.id}`)}>
                <strong>{t.name}</strong> <span>({t.owner})</span> <span className="pts">{t.total_points.toFixed(1)} pts</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
