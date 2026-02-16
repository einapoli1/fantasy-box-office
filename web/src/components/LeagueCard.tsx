interface Props {
  league: any;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  pending: '#e0d68a',
  drafting: '#ff6b35',
  active: '#4ecdc4',
  completed: '#95a5a6',
};

export default function LeagueCard({ league, onClick }: Props) {
  return (
    <div className="league-card" onClick={onClick}>
      <div className="league-card-header">
        <h3>{league.name}</h3>
        <span className="league-status" style={{ background: statusColors[league.status] || '#666' }}>
          {league.status}
        </span>
      </div>
      <div className="league-card-body">
        <span>🗓 {league.season_year}</span>
        <span>👥 {league.max_teams} teams max</span>
        {league.draft_date && <span>📋 Draft: {new Date(league.draft_date).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
