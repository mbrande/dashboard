import React, { useState, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((new Date() - new Date(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SeenRange({ first, last }) {
  if (!first && !last) return null;
  const tip = `First: ${fmtTs(first)}\nLast:  ${fmtTs(last)}`;
  return (
    <span className="fl-seen" title={tip}>
      last {timeAgo(last)} · first {timeAgo(first)}
    </span>
  );
}

export default function DashboardAuthEvents() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => {
      fetch(`${BASE}/dashboard-auth/summary`)
        .then(r => r.json())
        .then(d => setData(Array.isArray(d) ? d[0] : d))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useSSE('auth_summary', (payload) => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    if (obj) setData(obj);
  });

  if (!data || (data.total ?? 0) === 0) return null;

  const { total, real_attempts, probes, by_ip, by_path, recent, window_days } = data;

  return (
    <div className="card failed-logins-card">
      <div className="fl-header">
        <div className="fl-title-row">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ea4335" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
          </svg>
          <h2>Dashboard Auth Events</h2>
          <span className="fl-total">{total} in last {window_days || 7}d</span>
          <span className="insights-subtitle" style={{ marginLeft: 8 }}>
            {real_attempts} bad-password · {probes} unauth probe{probes === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="fl-body">
        <div className="fl-breakdown">
          <div className="fl-section">
            <h4>By Source IP</h4>
            {by_ip?.map((ip, i) => (
              <div key={i} className="fl-row">
                <span className="feed-net feed-src">{ip.ip}</span>
                <span className="fl-arrow">·</span>
                <span className="fl-agents" title={(ip.user_agents || []).join('\n')}>
                  {ip.real_attempts > 0 ? 'bad-password' : 'unauth'}
                </span>
                <SeenRange first={ip.first_seen} last={ip.last_seen} />
                <span className="fl-count">{ip.count}</span>
              </div>
            ))}
          </div>

          {by_path?.length > 0 && (
            <div className="fl-section">
              <h4>By Path</h4>
              {by_path.map((p, i) => {
                const pct = Math.round((p.count / total) * 100);
                return (
                  <div key={i} className="fl-user-row">
                    <span className="fl-user" title={p.path} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.path}
                    </span>
                    <div className="fl-user-bar-track">
                      <div className="fl-user-bar fl-agent-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="fl-count">{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="fl-recent">
          <h4>Recent Events</h4>
          <div className="fl-timeline">
            {recent?.slice(0, 20).map((r, i) => (
              <div key={r.id || i} className="fl-event">
                <div className="fl-event-dot" style={{ backgroundColor: r.had_auth ? '#ea4335' : '#9aa0a6' }} />
                <div className="fl-event-content">
                  <span className="fl-event-agent">{r.status}</span>
                  <span className="fl-event-desc">{r.method} {r.path}</span>
                  <span className="feed-net feed-src">{r.src_ip}</span>
                  {r.had_auth && <span className="fl-event-user">bad-password</span>}
                  <span className="fl-event-time" title={r.user_agent || ''}>
                    {fmtTs(r.occurred_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
