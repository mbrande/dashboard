import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../hooks/useSSE';

const BASE = process.env.REACT_APP_N8N_BASE_URL;
const liveFeedKey = ['wazuh', 'live-feed'];
const unwrap = (d) => (Array.isArray(d) ? d[0] : d);

// Wazuh severity: CRIT=15, HIGH=12-14, MED=7-11, LOW=0-6
const levelColor = (level) => {
  if (level >= 15) return '#d93025';
  if (level >= 12) return '#ea4335';
  if (level >= 7) return '#f9ab00';
  return '#9aa0a6';
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((new Date() - new Date(ts)) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveFeed() {
  const [paused, setPaused] = useState(false);
  const feedRef = useRef(null);
  const qc = useQueryClient();

  const { data: feed } = useQuery({
    queryKey: liveFeedKey,
    queryFn: () => fetch(`${BASE}/wazuh/live-feed`).then(r => r.json()),
    refetchInterval: paused ? false : 15000,
    select: unwrap,
  });

  // Real-time: SSE pushes new feed snapshots as the broadcaster refreshes.
  useSSE('wazuh_feed', (data) => {
    if (paused) return;
    qc.setQueryData(liveFeedKey, data);
  });

  if (!feed) return null;

  const alerts = feed.alerts || [];
  const srcIps = feed.src_ips || [];
  const dstIps = feed.dst_ips || [];
  const dnsQueries = feed.dns_queries || [];
  const connections = feed.connections || [];

  const hasSidebar = srcIps.length > 0 || dstIps.length > 0 || dnsQueries.length > 0 || connections.length > 0;

  return (
    <div className="card live-feed-card">
      <div className="live-feed-header">
        <div className="live-feed-title">
          <h2>Live Alert Feed</h2>
          <div className="live-feed-stats">
            <div className="eps-badge">
              <span className="eps-value">{feed.eps}</span>
              <span className="eps-label">EPS</span>
            </div>
            <span className="feed-count">{feed.total_5min} alerts in 5 min</span>
          </div>
        </div>
        <button className={`feed-pause ${paused ? 'is-paused' : ''}`} onClick={() => setPaused(!paused)}>
          {paused ? (
            <><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg> Resume</>
          ) : (
            <><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Pause</>
          )}
        </button>
      </div>

      <div className="live-feed-body">
        {/* Alert stream */}
        <div className="feed-stream" ref={feedRef}>
          {alerts.map((a, i) => (
            <div key={i} className="feed-item" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="feed-dot" style={{ backgroundColor: levelColor(a.level) }} />
              <span className="feed-agent">{a.agent}</span>
              <span className="feed-desc">{a.description}</span>
              {a.srcip && <span className="feed-net feed-src">{a.srcip}</span>}
              {a.dstip && <span className="feed-net feed-dst">{a.dstip}</span>}
              {a.dsthost && <span className="feed-net feed-dns">{a.dsthost}</span>}
              {a.dns_query && <span className="feed-net feed-dns">{a.dns_query}</span>}
              <span className="feed-time">{timeAgo(a.timestamp)}</span>
            </div>
          ))}
        </div>

        {/* Network context sidebar */}
        {hasSidebar && (
          <div className="feed-sidebar">
            {srcIps.length > 0 && (
              <div className="feed-sidebar-section">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12l4-4 4 4" /></svg>
                  Source IPs
                </h4>
                {srcIps.map((ip, i) => (
                  <div key={i} className="feed-sidebar-item">
                    <span className="feed-sidebar-val">{ip.ip}</span>
                    <span className="feed-sidebar-count">{ip.count}</span>
                  </div>
                ))}
              </div>
            )}

            {dstIps.length > 0 && (
              <div className="feed-sidebar-section">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16V8M8 12l4 4 4-4" /></svg>
                  Destination IPs
                </h4>
                {dstIps.map((ip, i) => (
                  <div key={i} className="feed-sidebar-item">
                    <span className="feed-sidebar-val">{ip.ip}</span>
                    <span className="feed-sidebar-count">{ip.count}</span>
                  </div>
                ))}
              </div>
            )}

            {connections.length > 0 && (
              <div className="feed-sidebar-section">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  Connections
                </h4>
                {connections.map((c, i) => (
                  <div key={i} className="feed-conn-item">
                    <div className="feed-conn-top">
                      <span className="feed-sidebar-val">{c.ip}</span>
                      <span className="feed-sidebar-count">{c.count}</span>
                    </div>
                    <div className="feed-conn-agents">
                      {c.agents.map((a, j) => (
                        <span key={j} className="feed-conn-agent">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dnsQueries.length > 0 && (
              <div className="feed-sidebar-section">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
                  DNS Queries
                </h4>
                {dnsQueries.map((q, i) => (
                  <div key={i} className="feed-sidebar-item">
                    <span className="feed-sidebar-val feed-domain" title={q.domain}>{q.domain}</span>
                    <span className="feed-sidebar-count">{q.count}</span>
                  </div>
                ))}
              </div>
            )}

            {srcIps.length === 0 && dstIps.length === 0 && connections.length === 0 && dnsQueries.length === 0 && (
              <div className="feed-sidebar-empty">No network data in current window</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
