interface Props {
  trade: any;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function TradeProposal({ trade, onAccept, onReject }: Props) {
  return (
    <div className="trade-proposal">
      <div className="trade-header">
        <span className={`trade-status ${trade.status}`}>{trade.status}</span>
        <span className="trade-date">{new Date(trade.proposed_at).toLocaleDateString()}</span>
      </div>
      <div className="trade-sides">
        <div className="trade-side">
          <h4>Offering</h4>
          {trade.offer_movies?.map((m: any) => <div key={m.id} className="trade-movie">{m.title}</div>) || <p>—</p>}
        </div>
        <div className="trade-arrow">⇄</div>
        <div className="trade-side">
          <h4>Requesting</h4>
          {trade.request_movies?.map((m: any) => <div key={m.id} className="trade-movie">{m.title}</div>) || <p>—</p>}
        </div>
      </div>
      {trade.status === 'pending' && (onAccept || onReject) && (
        <div className="trade-actions">
          {onAccept && <button className="btn btn-accept" onClick={onAccept}>Accept</button>}
          {onReject && <button className="btn btn-reject" onClick={onReject}>Reject</button>}
        </div>
      )}
    </div>
  );
}
