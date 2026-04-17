import React, { useState, useEffect } from 'react';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

// Wazuh severity: CRIT=15, HIGH=12-14, MED=7-11, LOW=0-6
const levelColor = (level) => {
  if (level >= 15) return '#d93025';
  if (level >= 12) return '#ea4335';
  if (level >= 7) return '#f9ab00';
  return '#9aa0a6';
};

export default function CriticalInsights() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => {
      fetch(`${BASE}/wazuh/insights`)
        .then(r => r.json())
        .then(d => setData(Array.isArray(d) ? d[0] : d))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  const { high_alerts, failed_auth, priv_escalation, vulnerabilities, src_ips } = data;
  const hasFindings = (high_alerts?.length > 0) || (failed_auth?.total > 0) ||
    (priv_escalation?.total > 0) || (vulnerabilities?.length > 0);

  if (!hasFindings) return null;

  return (
    <div className="insights-section">
      <div className="insights-header">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ea4335" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h2>Critical Insights</h2>
        <span className="insights-subtitle">Last 24 hours — things that need your attention</span>
      </div>

      <div className="insights-grid">
        {/* Vulnerabilities / CVEs */}
        {vulnerabilities?.length > 0 && (
          <div className="insight-card insight-vuln">
            <div className="insight-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div className="insight-title">Vulnerabilities Detected</div>
            <div className="insight-items">
              {vulnerabilities.map((v, i) => (
                <div key={i} className="insight-vuln-item">
                  <div className="insight-vuln-name">{v.description}</div>
                  <div className="insight-vuln-agents">
                    {v.agents?.map((a, j) => (
                      <span key={j} className="rule-agent-chip">{a.name}</span>
                    ))}
                    <span className="insight-vuln-count">x{v.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privilege Escalation */}
        {priv_escalation?.total > 0 && (
          <div className="insight-card insight-priv">
            <div className="insight-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div className="insight-title">Privilege Escalation</div>
            <div className="insight-count">{priv_escalation.total} sudo events</div>
            <div className="insight-items">
              {priv_escalation.by_agent?.map((p, i) => (
                <div key={i} className="insight-priv-item">
                  <span className="rule-agent-chip">{p.agent}</span>
                  <span className="insight-detail">{p.users?.join(', ')} → root</span>
                  <span className="insight-vuln-count">x{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Auth */}
        {failed_auth?.total > 0 && (
          <div className="insight-card insight-auth">
            <div className="insight-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <line x1="12" y1="15" x2="12" y2="18" />
              </svg>
            </div>
            <div className="insight-title">Failed Authentication</div>
            <div className="insight-count">{failed_auth.total} attempts</div>
            <div className="insight-items">
              {failed_auth.by_ip?.length > 0 && failed_auth.by_ip.map((ip, i) => (
                <div key={i} className="insight-ip-item">
                  <span className="feed-net feed-src">{ip.ip}</span>
                  <span className="insight-detail">→ {ip.agents?.join(', ')}</span>
                  <span className="insight-vuln-count">x{ip.count}</span>
                </div>
              ))}
              {(!failed_auth.by_ip || failed_auth.by_ip.length === 0) && failed_auth.by_user?.map((u, i) => (
                <div key={i} className="insight-ip-item">
                  <span className="badge badge-agent">{u.agents?.[0] || 'unknown'}</span>
                  <span className="insight-detail">user: <strong>{u.user}</strong></span>
                  <span className="insight-vuln-count">x{u.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High Severity (non-syscheck) */}
        {high_alerts?.length > 0 && (
          <div className="insight-card insight-high">
            <div className="insight-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="insight-title">High Severity Alerts</div>
            <div className="insight-subtitle">Excluding file integrity (shown separately)</div>
            <div className="insight-items">
              {high_alerts.slice(0, 8).map((a, i) => (
                <div key={i} className="insight-alert-item">
                  <div className="insight-alert-top">
                    <span className="rule-badge" style={{ color: levelColor(a.level), borderColor: levelColor(a.level) }}>
                      {a.level >= 15 ? 'CRIT' : a.level >= 12 ? 'HIGH' : 'MED'}
                    </span>
                    <span className="insight-alert-desc">{a.description}</span>
                    <span className="insight-alert-count">{a.count}</span>
                  </div>
                  <div className="insight-alert-agents">
                    {a.agents?.slice(0, 5).map((ag, j) => (
                      <span key={j} className="rule-agent-chip">{ag.name} <span className="rule-agent-count">{ag.count}</span></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
