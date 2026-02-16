interface Props {
  transactions: any[];
}

const typeIcons: Record<string, string> = {
  draft: '🎬',
  waiver: '📋',
  trade: '🔄',
  drop: '❌',
};

export default function TransactionFeed({ transactions }: Props) {
  if (!transactions.length) return <p className="empty">No transactions yet</p>;
  return (
    <div className="transaction-feed">
      {transactions.map((tx) => (
        <div key={tx.id} className="tx-item">
          <span className="tx-icon">{typeIcons[tx.type] || '📌'}</span>
          <span className="tx-text">
            <strong>{tx.team_name}</strong> {tx.type === 'drop' ? 'dropped' : `${tx.type}ed`}{' '}
            <em>{tx.movie_title}</em>
          </span>
          <span className="tx-date">{new Date(tx.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}
