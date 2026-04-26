import React from 'react';
import { useQuery } from '@tanstack/react-query';

const BASE = process.env.REACT_APP_N8N_BASE_URL;
const unwrap = (d) => (Array.isArray(d) ? d[0] : d);

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
  const sameMoment = first === last;
  const tip = `First: ${fmtTs(first)}\nLast:  ${fmtTs(last)}`;
  return (
    <span className="fl-seen" title={tip}>
      {sameMoment
        ? fmtTs(last)
        : <>last {timeAgo(last)} · first {timeAgo(first)}</>}
    </span>
  );
}

export default function FailedLogins() {
  const { data } = useQuery({
    queryKey: ['wazuh', 'failed-logins'],
    queryFn: () => fetch(`${BASE}/wazuh/failed-logins`).then(r => r.json()),
    refetchInterval: 60000,
    select: unwrap,
  });

  if (!data || data.total === 0) return null;

  const { total, by_agent, by_ip, by_user, recent } = data;

  return (
    <div className="card failed-logins-card">
      <div className="fl-header">
        <div className="fl-title-row">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ea4335" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <line x1="12" y1="15" x2="12" y2="18" />
          </svg>
          <h2>Failed Logins</h2>
          <span className="fl-total">{total} total</span>
        </div>
      </div>

      <div className="fl-body">
        {/* Left: breakdown cards */}
        <div className="fl-breakdown">
          {/* By source IP */}
          <div className="fl-section">
            <h4>Source IPs</h4>
            {by_ip?.map((ip, i) => (
              <div key={i} className="fl-row">
                <span className="feed-net feed-src">{ip.ip}</span>
                <span className="fl-arrow">→</span>
                <span className="fl-agents">{ip.agents?.join(', ')}</span>
                <SeenRange first={ip.first_seen} last={ip.last_seen} />
                <span className="fl-count">{ip.count}</span>
              </div>
            ))}
          </div>

          {/* By user */}
          <div className="fl-section">
            <h4>Targeted Users</h4>
            {by_user?.map((u, i) => {
              const pct = Math.round((u.count / total) * 100);
              return (
                <div key={i} className="fl-user-row">
                  <span className="fl-user">{u.user}</span>
                  <div className="fl-user-bar-track">
                    <div className="fl-user-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <SeenRange first={u.first_seen} last={u.last_seen} />
                  <span className="fl-count">{u.count}</span>
                </div>
              );
            })}
          </div>

          {/* By agent */}
          <div className="fl-section">
            <h4>Targeted Agents</h4>
            {by_agent?.map((a, i) => {
              const pct = Math.round((a.count / total) * 100);
              return (
                <div key={i} className="fl-user-row">
                  <span className="fl-user">{a.agent}</span>
                  <div className="fl-user-bar-track">
                    <div className="fl-user-bar fl-agent-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <SeenRange first={a.first_seen} last={a.last_seen} />
                  <span className="fl-count">{a.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: recent events */}
        <div className="fl-recent">
          <h4>Recent Failed Logins</h4>
          <div className="fl-timeline">
            {recent?.slice(0, 20).map((r, i) => (
              <div key={i} className="fl-event">
                <div className="fl-event-dot" />
                <div className="fl-event-content">
                  <span className="fl-event-agent">{r.agent}</span>
                  <span className="fl-event-desc">{r.description}</span>
                  {r.srcip && <span className="feed-net feed-src">{r.srcip}</span>}
                  {r.user && <span className="fl-event-user">{r.user}</span>}
                  <span className="fl-event-time" title={r.timestamp}>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
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
