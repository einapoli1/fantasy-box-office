import { useState } from 'react';

interface Props {
  inviteCode: string;
  onClose: () => void;
}

export default function InviteDialog({ inviteCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join/${inviteCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Invite Friends</h2>
        <p>Share this link to invite players to your league:</p>
        <div className="invite-link-row">
          <input type="text" readOnly value={link} className="invite-link-input" />
          <button className="btn btn-primary btn-sm" onClick={copy}>
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '1rem' }}>Close</button>
      </div>
    </div>
  );
}
