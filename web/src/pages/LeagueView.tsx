import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import StandingsTable from '../components/StandingsTable';
import TransactionFeed from '../components/TransactionFeed';
import LeagueChat from '../components/LeagueChat';
import InviteDialog from '../components/InviteDialog';
import Skeleton from '../components/Skeleton';

export default function LeagueView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [league, setLeague] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<'standings' | 'activity'>('standings');
  const [chatOpen, setChatOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState('');

  const leagueId = parseInt(id!);

  useEffect(() => {
    Promise.all([
      api.getLeague(leagueId).then(setLeague),
      api.getStandings(leagueId).then(setStandings),
      api.getTransactions(leagueId).then(setTransactions),
    ]).catch(e => setError(e.message));
  }, [leagueId]);

  if (error) return (
    <div className="league-view">
      <div className="error-state">
        <p>Failed to load league: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  if (!league) return <div className="league-view"><Skeleton lines={8} /></div>;

  const isOwner = league.owner_id === user?.id;

  return (
    <div className={`league-view ${chatOpen ? 'with-chat' : ''}`}>
      <div className="league-main">
        <div className="league-header">
          <div>
            <h1>{league.name}</h1>
            <span className={`league-status-lg ${league.status}`}>{league.status}</span>
            <span className="season">{league.season_year} Season</span>
          </div>
          <div className="league-actions">
            {league.status === 'pending' && isOwner && (
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await api.startDraft(leagueId);
                  navigate(`/league/${leagueId}/draft`);
                } catch (e: any) {
                  alert(e.message || 'Failed to start draft. Need at least 2 teams.');
                }
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
            <button className="btn btn-secondary" onClick={() => setInviteOpen(true)}>🔗 Invite Friends</button>
            <button className="btn btn-secondary" onClick={() => setChatOpen(!chatOpen)}>
              💬 {chatOpen ? 'Hide Chat' : 'Chat'}
            </button>
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

      {chatOpen && (
        <div className="league-chat-sidebar">
          <LeagueChat leagueId={leagueId} />
        </div>
      )}

      {inviteOpen && (
        <InviteDialog
          inviteCode={league.invite_code || league.id.toString()}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
