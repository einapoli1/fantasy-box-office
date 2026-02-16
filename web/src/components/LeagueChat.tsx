import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import type { ChatMessage } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface Props {
  leagueId: number;
}

export default function LeagueChat({ leagueId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatHistory(leagueId).then(setMessages).catch(() => {});
  }, [leagueId]);

  const { status, send } = useWebSocket(`/ws/chat/${leagueId}`, (data) => {
    if (data.type === 'message') {
      setMessages(prev => [...prev, data.payload]);
    }
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    send({ type: 'message', message: text });
    setInput('');
  };

  return (
    <div className="league-chat">
      <div className="chat-header">
        <h3>💬 League Chat</h3>
        <span className={`ws-status ${status}`}>{status}</span>
      </div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="empty">No messages yet. Say hello!</p>}
        {messages.map(m => (
          <div key={m.id} className="chat-msg">
            <div className="chat-avatar">{m.display_name?.[0]?.toUpperCase() || '?'}</div>
            <div className="chat-msg-content">
              <div className="chat-msg-header">
                <strong>{m.display_name}</strong>
                <span className="chat-time">{new Date(m.created_at).toLocaleTimeString()}</span>
              </div>
              <p>{m.message}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
