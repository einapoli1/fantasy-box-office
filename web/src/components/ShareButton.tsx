import { useState } from 'react';

interface Props {
  title: string;
  text: string;
  url?: string;
}

export default function ShareButton({ title, text, url }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window.location.href;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="share-buttons">
      <button className="btn btn-sm btn-secondary" onClick={handleShare}>
        {copied ? '✅ Copied!' : '🔗 Share'}
      </button>
      <a className="btn btn-sm btn-secondary" href={twitterUrl} target="_blank" rel="noopener noreferrer">
        🐦 Tweet
      </a>
    </div>
  );
}
