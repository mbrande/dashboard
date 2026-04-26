import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { fetchAgentFim, fetchAgentCriticalFim, fetchAgentFimHistory, fetchAgentSca, fetchAgentScaFails, fetchAgentPorts, fetchAgentProcesses, fetchAgentAlerts } from '../api/wazuh';

const platformInfo = {
  windows: { label: 'Windows', color: '#1a73e8', bg: '#e8f0fe' },
  ubuntu: { label: 'Ubuntu', color: '#137333', bg: '#e6f4ea' },
  debian: { label: 'Debian', color: '#137333', bg: '#e6f4ea' },
  darwin: { label: 'macOS', color: '#8430ce', bg: '#f3e8fd' }
};

const tooltipStyle = {
  backgroundColor: '#fff', border: '1px solid #e0e0e0',
  borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
};

const PIE_COLORS = ['#1a73e8', '#34a853', '#f9ab00', '#ea4335', '#8430ce', '#e8710a'];

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ScoreRing({ score, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#34a853' : score >= 40 ? '#f9ab00' : '#ea4335';

  return (
    <svg width={size} height={size} className="score-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f3f4" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.35em" fontSize="1.1rem"
        fontWeight="600" fill="#202124">{score}%</text>
    </svg>
  );
}

export default function AgentDetail({ agent, onClose }) {
  const [fimEvents, setFimEvents] = useState([]);
  const [criticalFim, setCriticalFim] = useState([]);
  const [fimHistory, setFimHistory] = useState([]);
  const [sca, setSca] = useState([]);
  const [scaFails, setScaFails] = useState([]);
  const [scaFailsLoading, setScaFailsLoading] = useState(false);
  const [ports, setPorts] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('');
  const [expandedFail, setExpandedFail] = useState(null);
  const [procFilter, setProcFilter] = useState('');
  const [sevFilter, setSevFilter] = useState(null);

  useEffect(() => {
    document.body.classList.add('panel-open');
    return () => document.body.classList.remove('panel-open');
  }, []);

  useEffect(() => {
    setLoading(true);
    setActiveTab('overview');
    setFilter('');
    setScaFails([]);
    setPorts([]);
    setProcesses([]);
    setAlerts(null);
    setProcFilter('');
    Promise.all([
      fetchAgentFim(agent.agent_id),
      fetchAgentCriticalFim(agent.agent_id),
      fetchAgentFimHistory(agent.agent_id),
      fetchAgentSca(agent.agent_id),
      fetchAgentPorts(agent.agent_id),
      fetchAgentProcesses(agent.agent_id),
      fetchAgentAlerts(agent.agent_name)
    ]).then(([fim, cfim, hist, scaData, portsData, procsData, alertsData]) => {
      setFimEvents(Array.isArray(fim) ? fim : []);
      setCriticalFim(Array.isArray(cfim) ? cfim : []);
      setFimHistory(Array.isArray(hist) ? hist.reverse() : []);
      setSca(Array.isArray(scaData) ? scaData : []);
      setPorts(Array.isArray(portsData) ? portsData : []);
      setProcesses(Array.isArray(procsData) ? procsData : []);
      const ad = Array.isArray(alertsData) ? alertsData[0] : alertsData;
      setAlerts(ad || null);
      setLoading(false);
    });
  }, [agent.agent_id, agent.agent_name]);

  const loadScaFails = (policyId) => {
    setScaFailsLoading(true);
    fetchAgentScaFails(agent.agent_id, policyId).then(data => {
      setScaFails(Array.isArray(data) ? data : []);
      setScaFailsLoading(false);
    });
  };

  const pi = platformInfo[agent.platform] || { label: agent.platform, color: '#5f6368', bg: '#f1f3f4' };

  const dirBreakdown = {};
  fimEvents.forEach(e => {
    const parts = (e.file_path || '').split('/');
    const dir = parts.length >= 3 ? `/${parts[1]}/${parts[2]}/` : parts[0] || '/';
    dirBreakdown[dir] = (dirBreakdown[dir] || 0) + 1;
  });
  const topDirs = Object.entries(dirBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const fileTypes = {};
  fimEvents.forEach(e => {
    const ft = e.file_type || e.event_type || 'unknown';
    fileTypes[ft] = (fileTypes[ft] || 0) + 1;
  });
  const pieData = Object.entries(fileTypes).map(([name, value]) => ({ name, value }));

  const filtered = filter ? fimEvents.filter(e => e.file_path?.toLowerCase().includes(filter.toLowerCase())) : fimEvents;
  const critFiltered = filter ? criticalFim.filter(e => e.file_path?.toLowerCase().includes(filter.toLowerCase())) : criticalFim;

  const alertTotal = alerts?.total_alerts || 0;
  const sevRanges = { critical: [15, 99], high: [12, 14], medium: [7, 11], low: [0, 6] };
  const filteredRules = sevFilter && alerts?.top_rules
    ? alerts.top_rules.filter(r => r.level >= sevRanges[sevFilter][0] && r.level <= sevRanges[sevFilter][1])
    : (alerts?.top_rules || []);
  const filteredRecent = sevFilter && alerts?.recent_alerts
    ? alerts.recent_alerts.filter(a => a.level >= sevRanges[sevFilter][0] && a.level <= sevRanges[sevFilter][1])
    : (alerts?.recent_alerts || []);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'alerts', label: `Alerts (${alertTotal.toLocaleString()})` },
    { id: 'security', label: `Security${sca.length ? ` (${sca[0]?.score}%)` : ''}` },
    { id: 'critical', label: `Critical (${criticalFim.length})` },
    { id: 'all-events', label: `All Events (${fimEvents.length})` }
  ];

  return (
    <div className="agent-detail-overlay" onClick={onClose}>
      <div className="agent-detail" onClick={e => e.stopPropagation()}>
        <div className="ad-header">
          <div className="ad-header-left">
            <div className="ad-avatar" style={{ background: pi.bg, color: pi.color }}>
              {agent.agent_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="ad-name">{agent.agent_name}</h2>
              <div className="ad-meta">
                <span className={`status-dot ${agent.status === 'active' ? 'active' : 'inactive'}`} />
                <span>{agent.status}</span>
                <span className="ad-sep">&middot;</span>
                <span style={{ color: pi.color }}>{pi.label}</span>
                <span className="ad-sep">&middot;</span>
                <span>Agent {agent.agent_id}</span>
              </div>
            </div>
          </div>
          <button className="ad-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ad-stats">
          <div className="ad-stat">
            <div className="ad-stat-val">{agent.total_fim_events?.toLocaleString() || '0'}</div>
            <div className="ad-stat-label">Total FIM</div>
          </div>
          <div className="ad-stat">
            <div className="ad-stat-val">{criticalFim.length}</div>
            <div className="ad-stat-label">Critical Changes</div>
          </div>
          <div className="ad-stat">
            <div className="ad-stat-val">{sca[0]?.score ?? '—'}{sca[0]?.score != null && '%'}</div>
            <div className="ad-stat-label">CIS Score</div>
          </div>
          <div className="ad-stat">
            <div className="ad-stat-val">{sca[0]?.fail ?? '—'}</div>
            <div className="ad-stat-label">Failed Checks</div>
          </div>
        </div>

        <div className="ad-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`ad-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => { setActiveTab(t.id); setFilter(''); }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ad-loading"><div className="spinner" /> Loading agent data...</div>
        ) : (
          <div className="ad-content">
            {activeTab === 'overview' && (
              <>
                {fimHistory.length > 1 && (
                  <div className="ad-section">
                    <h3>FIM Activity Over Time</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={fimHistory.map(h => ({
                        time: new Date(h.captured_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
                        events: h.recent_fim_events
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                        <XAxis dataKey="time" stroke="#9aa0a6" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#9aa0a6" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <defs>
                          <linearGradient id="agentGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={pi.color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={pi.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="events" stroke={pi.color} fill="url(#agentGrad)" strokeWidth={2} name="FIM Events" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="ad-two-col">
                  <div className="ad-section">
                    <h3>Most Active Directories</h3>
                    <div className="dir-list">
                      {topDirs.map(([dir, count], i) => (
                        <div key={i} className="dir-row">
                          <div className="dir-bar-bg">
                            <div className="dir-bar" style={{ width: `${(count / topDirs[0][1]) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                          <div className="dir-info">
                            <span className="dir-path">{dir}</span>
                            <span className="dir-count">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {pieData.length > 0 && (
                    <div className="ad-section">
                      <h3>Event Types</h3>
                      <div className="pie-wrap">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                          {pieData.map((d, i) => (
                            <div key={i} className="pie-legend-item">
                              <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="pie-label">{d.name}</span>
                              <span className="pie-val">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {criticalFim.length > 0 && (
                  <div className="ad-section">
                    <h3>Recent Critical File Changes</h3>
                    <div className="ad-table-wrap">
                      <table><thead><tr><th>File Path</th><th>Size</th><th>MD5</th><th>Changed</th></tr></thead>
                        <tbody>
                          {criticalFim.slice(0, 10).map((e, i) => (
                            <tr key={i}>
                              <td className="mono file-path" title={e.file_path}>{e.file_path}</td>
                              <td className="mono">{formatSize(e.size)}</td>
                              <td className="mono hash" title={e.md5}>{e.md5?.slice(0, 12)}</td>
                              <td className="dim">{timeAgo(e.fim_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'alerts' && alerts && (
              <>
                {/* Severity breakdown - clickable */}
                <div className="alert-severity-row">
                  {[
                    { key: 'critical', label: 'Critical', color: '#d93025', minLevel: 12, maxLevel: 99 },
                    { key: 'high', label: 'High', color: '#ea4335', minLevel: 8, maxLevel: 11 },
                    { key: 'medium', label: 'Medium', color: '#f9ab00', minLevel: 4, maxLevel: 7 },
                    { key: 'low', label: 'Low', color: '#9aa0a6', minLevel: 0, maxLevel: 3 }
                  ].map(s => (
                    <div key={s.key}
                      className={`alert-sev-card clickable ${sevFilter === s.key ? 'sev-active' : ''}`}
                      style={sevFilter === s.key ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}` } : {}}
                      onClick={() => setSevFilter(sevFilter === s.key ? null : s.key)}>
                      <div className="alert-sev-count" style={{ color: s.color }}>
                        {(alerts.severity?.[s.key] || 0).toLocaleString()}
                      </div>
                      <div className="alert-sev-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                {sevFilter && (
                  <div className="sev-filter-banner">
                    Filtering by <strong>{sevFilter}</strong> severity
                    <button className="sev-clear" onClick={() => setSevFilter(null)}>Clear</button>
                  </div>
                )}

                {/* Hourly alert chart */}
                {alerts.hourly?.length > 0 && (
                  <div className="ad-section">
                    <h3>Alert Activity (Last 24h)</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={alerts.hourly.map(h => ({
                        time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        total: h.total,
                        high: h.high
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                        <XAxis dataKey="time" stroke="#9aa0a6" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis stroke="#9aa0a6" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <defs>
                          <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#1a73e8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="total" stroke="#1a73e8" fill="url(#alertGrad)" strokeWidth={2} name="Total" />
                        <Area type="monotone" dataKey="high" stroke="#ea4335" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="High+" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top rules for this agent */}
                {filteredRules.length > 0 && (
                  <div className="ad-section">
                    <h3>Top Triggered Rules (24h){sevFilter ? ` — ${sevFilter}` : ''}</h3>
                    <div className="agent-rules-list">
                      {filteredRules.map((r, i) => {
                        const maxCount = filteredRules[0].count;
                        const lc = r.level >= 15 ? '#d93025' : r.level >= 12 ? '#ea4335' : r.level >= 7 ? '#f9ab00' : '#9aa0a6';
                        return (
                          <div key={i} className="agent-rule-row">
                            <div className="agent-rule-bar" style={{ width: `${(r.count / maxCount) * 100}%`, backgroundColor: lc, opacity: 0.1 }} />
                            <div className="agent-rule-content">
                              <span className="rule-badge" style={{ color: lc, borderColor: lc }}>
                                {r.level >= 15 ? 'CRIT' : r.level >= 12 ? 'HIGH' : r.level >= 7 ? 'MED' : 'LOW'}
                              </span>
                              <span className="agent-rule-desc">{r.description}</span>
                              <span className="agent-rule-count">{r.count.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent alerts timeline */}
                {filteredRecent.length > 0 && (
                  <div className="ad-section">
                    <h3>Recent Alerts{sevFilter ? ` — ${sevFilter}` : ''}</h3>
                    <div className="alert-timeline">
                      {filteredRecent.map((a, i) => {
                        const lc = a.level >= 15 ? '#d93025' : a.level >= 12 ? '#ea4335' : a.level >= 7 ? '#f9ab00' : '#9aa0a6';
                        return (
                          <div key={i} className="alert-timeline-item">
                            <div className="alert-timeline-dot" style={{ backgroundColor: lc }} />
                            <div className="alert-timeline-content">
                              <div className="alert-timeline-top">
                                <span className="alert-timeline-desc">{a.description}</span>
                                <span className="alert-timeline-time">{timeAgo(a.timestamp)}</span>
                              </div>
                              <div className="alert-timeline-meta">
                                Rule {a.rule_id} · Level {a.level}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredRules.length === 0 && filteredRecent.length === 0 && sevFilter && (
                  <div className="empty-state">No {sevFilter} severity alerts in the last 24 hours</div>
                )}

                {alertTotal === 0 && !sevFilter && <div className="empty-state">No alerts in the last 24 hours</div>}
              </>
            )}

            {activeTab === 'security' && (
              <>
                {sca.map((policy, idx) => (
                  <div key={idx} className="ad-section">
                    <div className="sca-policy-card">
                      <div className="sca-policy-header">
                        <ScoreRing score={policy.score} />
                        <div className="sca-policy-info">
                          <h3>{policy.name}</h3>
                          <p className="sca-policy-desc">{policy.description}</p>
                          <div className="sca-policy-meta">
                            Last scan: {new Date(policy.end_scan).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="sca-bars">
                        <div className="sca-bar-row">
                          <span className="sca-bar-label">Passed</span>
                          <div className="sca-bar-track">
                            <div className="sca-bar-fill sca-pass" style={{ width: `${(policy.pass / policy.total_checks) * 100}%` }} />
                          </div>
                          <span className="sca-bar-val">{policy.pass}</span>
                        </div>
                        <div className="sca-bar-row">
                          <span className="sca-bar-label">Failed</span>
                          <div className="sca-bar-track">
                            <div className="sca-bar-fill sca-fail" style={{ width: `${(policy.fail / policy.total_checks) * 100}%` }} />
                          </div>
                          <span className="sca-bar-val">{policy.fail}</span>
                        </div>
                        <div className="sca-bar-row">
                          <span className="sca-bar-label">N/A</span>
                          <div className="sca-bar-track">
                            <div className="sca-bar-fill sca-na" style={{ width: `${(policy.invalid / policy.total_checks) * 100}%` }} />
                          </div>
                          <span className="sca-bar-val">{policy.invalid}</span>
                        </div>
                      </div>

                      {!scaFails.length && !scaFailsLoading && (
                        <button className="btn btn-outline sca-show-fails" onClick={() => loadScaFails(policy.policy_id)}>
                          Show {policy.fail} Failed Checks
                        </button>
                      )}
                    </div>

                    {scaFailsLoading && <div className="ad-loading"><div className="spinner" /> Loading failed checks...</div>}

                    {scaFails.length > 0 && (
                      <div className="sca-fails">
                        <h3>Failed Checks ({scaFails.length})</h3>
                        <div className="sca-fails-list">
                          {scaFails.map((f, i) => (
                            <div key={i} className={`sca-fail-item ${expandedFail === i ? 'expanded' : ''}`}
                              onClick={() => setExpandedFail(expandedFail === i ? null : i)}>
                              <div className="sca-fail-header">
                                <svg className="sca-fail-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ea4335" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                                </svg>
                                <span className="sca-fail-title">{f.title}</span>
                                <svg className={`sca-chevron ${expandedFail === i ? 'open' : ''}`} viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </div>
                              {expandedFail === i && (
                                <div className="sca-fail-body">
                                  {f.rationale && <div className="sca-fail-section"><strong>Why:</strong> {f.rationale}</div>}
                                  {f.remediation && <div className="sca-fail-section"><strong>Fix:</strong> {f.remediation}</div>}
                                  {f.description && <div className="sca-fail-section sca-fail-desc">{f.description}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {sca.length === 0 && <div className="empty-state">No SCA data available for this agent</div>}

                {/* Listening Ports */}
                {ports.length > 0 && (
                  <div className="ad-section" style={{ marginTop: 24 }}>
                    <h3>Listening Ports ({ports.length})</h3>
                    <div className="ports-grid">
                      {ports.map((p, i) => (
                        <div key={i} className="port-chip">
                          <span className="port-number">{p.port}</span>
                          <span className="port-proto">{p.protocol}</span>
                          {p.process && <span className="port-process">{p.process}</span>}
                          {p.ip && p.ip !== '0.0.0.0' && p.ip !== '::' && <span className="port-ip">{p.ip}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Running Processes */}
                {processes.length > 0 && (
                  <div className="ad-section" style={{ marginTop: 24 }}>
                    <div className="ad-section-header">
                      <h3>Running Processes ({processes.length})</h3>
                      <input type="text" placeholder="Filter processes..." value={procFilter}
                        onChange={e => setProcFilter(e.target.value)} className="filter-input" />
                    </div>
                    <div className="ad-table-wrap">
                      <table>
                        <thead><tr><th>Process</th><th>PID</th><th>User</th><th>State</th></tr></thead>
                        <tbody>
                          {processes
                            .filter(p => !procFilter || p.name?.toLowerCase().includes(procFilter.toLowerCase()) || p.user?.toLowerCase().includes(procFilter.toLowerCase()) || p.cmd?.toLowerCase().includes(procFilter.toLowerCase()))
                            .slice(0, 100)
                            .map((p, i) => (
                            <tr key={i}>
                              <td className="mono" title={p.cmd}>{p.name}</td>
                              <td className="mono">{p.pid}</td>
                              <td>{p.user || '—'}</td>
                              <td className="dim">{p.state || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {processes.length > 100 && <div className="table-footer">Showing 100 of {processes.length}</div>}
                  </div>
                )}
              </>
            )}

            {activeTab === 'critical' && (
              <div className="ad-section">
                <div className="ad-section-header">
                  <h3>Critical Path Changes</h3>
                  <input type="text" placeholder="Filter paths..." value={filter} onChange={e => setFilter(e.target.value)} className="filter-input" />
                </div>
                <div className="ad-table-wrap">
                  <table><thead><tr><th>File Path</th><th>Size</th><th>MD5</th><th>SHA256</th><th>Changed</th></tr></thead>
                    <tbody>
                      {critFiltered.map((e, i) => (
                        <tr key={i}>
                          <td className="mono file-path" title={e.file_path}>{e.file_path}</td>
                          <td className="mono">{formatSize(e.size)}</td>
                          <td className="mono hash" title={e.md5}>{e.md5?.slice(0, 12)}</td>
                          <td className="mono hash" title={e.sha256}>{e.sha256?.slice(0, 12)}</td>
                          <td className="dim">{timeAgo(e.fim_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {critFiltered.length === 0 && <div className="empty-state">No critical path changes</div>}
              </div>
            )}

            {activeTab === 'all-events' && (
              <div className="ad-section">
                <div className="ad-section-header">
                  <h3>All FIM Events</h3>
                  <input type="text" placeholder="Filter paths..." value={filter} onChange={e => setFilter(e.target.value)} className="filter-input" />
                </div>
                <div className="ad-table-wrap">
                  <table><thead><tr><th>File Path</th><th>Type</th><th>Size</th><th>MD5</th><th>Changed</th></tr></thead>
                    <tbody>
                      {filtered.slice(0, 200).map((e, i) => (
                        <tr key={i}>
                          <td className="mono file-path" title={e.file_path}>{e.file_path}</td>
                          <td>{e.event_type}</td>
                          <td className="mono">{formatSize(e.size)}</td>
                          <td className="mono hash" title={e.md5}>{e.md5?.slice(0, 12)}</td>
                          <td className="dim">{timeAgo(e.fim_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 200 && <div className="table-footer">Showing 200 of {filtered.length}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
