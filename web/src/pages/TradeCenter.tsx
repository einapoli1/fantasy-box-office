import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, TradeAnalysis } from '../lib/api';
import TradeProposal from '../components/TradeProposal';
import Skeleton from '../components/Skeleton';

export default function TradeCenter() {
  const { id } = useParams();
  const leagueId = parseInt(id!);
  const [trades, setTrades] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trade proposal state
  const [showPropose, setShowPropose] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<number | ''>('');
  const [offerMovies, setOfferMovies] = useState<number[]>([]);
  const [requestMovies, setRequestMovies] = useState<number[]>([]);
  const [myRoster, setMyRoster] = useState<any[]>([]);
  const [theirRoster, setTheirRoster] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getLeagueTrades(leagueId).then(setTrades),
      api.getLeague(leagueId).then(l => setTeams(l.teams || [])),
    ]).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [leagueId]);

  const loadRosters = async (teamId: number) => {
    setTargetTeamId(teamId);
    setRequestMovies([]);
    setAnalysis(null);
    try { setTheirRoster(await api.getTeamRoster(teamId)); } catch {}
  };

  const runAnalysis = async () => {
    if (offerMovies.length === 0 && requestMovies.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await api.analyzeTrade({ offer_movie_ids: offerMovies, request_movie_ids: requestMovies });
      setAnalysis(result);
    } catch { setAnalysis(null); }
    setAnalyzing(false);
  };

  // Auto-analyze when selections change
  useEffect(() => {
    if (offerMovies.length > 0 || requestMovies.length > 0) {
      const t = setTimeout(runAnalysis, 500);
      return () => clearTimeout(t);
    } else {
      setAnalysis(null);
    }
  }, [offerMovies, requestMovies]);

  const handlePropose = async () => {
    if (!targetTeamId || offerMovies.length === 0 || requestMovies.length === 0) return;
    setProposing(true);
    try {
      await api.createTrade({
        league_id: leagueId,
        target_team_id: targetTeamId,
        offer_movie_ids: offerMovies,
        request_movie_ids: requestMovies,
      });
      setShowPropose(false);
      setOfferMovies([]);
      setRequestMovies([]);
      setAnalysis(null);
      const updated = await api.getLeagueTrades(leagueId);
      setTrades(updated);
    } catch (err: any) {
      alert(err.message);
    }
    setProposing(false);
  };

  const toggleMovie = (id: number, list: number[], setList: (v: number[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const ratingColor = (rating: string) => {
    switch (rating) {
      case 'favorable': return '#4ecdc4';
      case 'unfavorable': return '#ff6b6b';
      default: return '#e0d68a';
    }
  };

  if (loading) return <div className="trade-center"><Skeleton lines={6} /></div>;
  if (error) return (
    <div className="trade-center">
      <div className="error-state">
        <p>Failed to load trades: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="trade-center">
      <div className="trade-center-header">
        <h1>🔄 Trade Center</h1>
        <button className="btn btn-primary" onClick={async () => {
          setShowPropose(true);
          // Load my team's roster
          const league = await api.getLeague(leagueId);
          const myTeam = league.teams?.find((t: any) => t.owner_id === league.owner_id);
          if (myTeam) setMyRoster(await api.getTeamRoster(myTeam.id));
        }}>Propose Trade</button>
      </div>

      {showPropose && (
        <div className="modal-overlay" onClick={() => setShowPropose(false)}>
          <div className="modal trade-modal" onClick={e => e.stopPropagation()}>
            <h2>Propose Trade</h2>

            <div className="trade-setup">
              <label>Trade with:</label>
              <select value={targetTeamId} onChange={e => loadRosters(parseInt(e.target.value))}>
                <option value="">Select a team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {targetTeamId && (
              <div className="trade-comparison">
                <div className="trade-side">
                  <h3>You Give</h3>
                  <div className="trade-movie-select">
                    {myRoster.map(r => (
                      <label key={r.movie_id} className={`trade-movie-option ${offerMovies.includes(r.movie_id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={offerMovies.includes(r.movie_id)}
                          onChange={() => toggleMovie(r.movie_id, offerMovies, setOfferMovies)} />
                        {r.movie?.title || `Movie #${r.movie_id}`}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="trade-arrow-big">⇄</div>

                <div className="trade-side">
                  <h3>You Receive</h3>
                  <div className="trade-movie-select">
                    {theirRoster.map(r => (
                      <label key={r.movie_id} className={`trade-movie-option ${requestMovies.includes(r.movie_id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={requestMovies.includes(r.movie_id)}
                          onChange={() => toggleMovie(r.movie_id, requestMovies, setRequestMovies)} />
                        {r.movie?.title || `Movie #${r.movie_id}`}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Trade Analysis */}
            {analysis && (
              <div className="trade-analysis" style={{ borderColor: ratingColor(analysis.rating) }}>
                <h3>📊 Trade Analysis</h3>
                <div className="analysis-numbers">
                  <div className="analysis-col">
                    <span className="analysis-label">You Give Up</span>
                    <span className="analysis-value">{analysis.give_points.toFixed(1)} pts</span>
                  </div>
                  <div className="analysis-col">
                    <span className="analysis-label">You Receive</span>
                    <span className="analysis-value">{analysis.receive_points.toFixed(1)} pts</span>
                  </div>
                  <div className="analysis-col">
                    <span className="analysis-label">Net</span>
                    <span className="analysis-value" style={{ color: ratingColor(analysis.rating) }}>
                      {analysis.difference > 0 ? '+' : ''}{analysis.difference.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <p className="analysis-recommendation" style={{ color: ratingColor(analysis.rating) }}>
                  {analysis.recommendation}
                </p>
              </div>
            )}
            {analyzing && <p className="analyzing">Analyzing trade...</p>}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handlePropose}
                disabled={proposing || offerMovies.length === 0 || requestMovies.length === 0}>
                {proposing ? 'Proposing...' : 'Propose Trade'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowPropose(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <section>
        <h2>Recent Trades</h2>
        {trades.length === 0 ? (
          <p className="empty">No trade activity yet. Be the first to propose a trade!</p>
        ) : (
          <div className="trade-list">
            {trades.map(t => (
              <TradeProposal
                key={t.id}
                trade={t}
                onAccept={t.status === 'pending' ? async () => {
                  await api.acceptTrade(t.id);
                  setTrades(await api.getLeagueTrades(leagueId));
                } : undefined}
                onReject={t.status === 'pending' ? async () => {
                  await api.rejectTrade(t.id);
                  setTrades(await api.getLeagueTrades(leagueId));
                } : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
