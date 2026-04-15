import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api/news';

export default function NewsChat({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(text, sessionId);
      const result = Array.isArray(res) ? res[0] : res;
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: result.reply || result.message || 'No response',
        sources: result.sources || [],
        searchedWeb: result.searched_web || false
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I could not process that request.',
        sources: []
      }]);
    }

    setLoading(false);
  };

  return (
    <div className="news-chat-panel">
      <div className="news-chat-header">
        <span className="news-chat-title">News Assistant</span>
        <button className="ad-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="news-chat-messages">
        {messages.length === 0 && (
          <div className="news-chat-empty">
            <p>Ask me about recent news.</p>
            <p className="dim">I can search stored articles or the web.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            <div className="chat-msg-text">{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="chat-sources">
                {m.sources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="chat-source-link">
                    {s.title || 'Source'}
                  </a>
                ))}
              </div>
            )}
            {m.searchedWeb && <span className="chat-web-badge">Searched web</span>}
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-assistant">
            <div className="chat-typing"><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="news-chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about recent AI news..."
          disabled={loading}
        />
        <button className="btn" onClick={send} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}
