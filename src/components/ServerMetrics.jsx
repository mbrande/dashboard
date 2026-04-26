import React from 'react';
import { useQueries } from '@tanstack/react-query';
import ZabbixProblemStream from './ZabbixProblemStream';

const BASE = process.env.REACT_APP_N8N_BASE_URL;
const unwrap = (d) => (Array.isArray(d) ? d[0] : d);

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

function formatBytes(b) {
  if (!b) return '—';
  const gb = b / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / (1024 * 1024)).toFixed(0)} MB`;
}

function GaugeBar({ value, label, color, warn = 70, crit = 90 }) {
  if (value === null || value === undefined) return <div className="gauge-na">{label}: N/A</div>;
  const barColor = value >= crit ? '#d93025' : value >= warn ? '#f9ab00' : color || '#34a853';
  return (
    <div className="gauge-row">
      <span className="gauge-label">{label}</span>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor }} />
      </div>
      <span className="gauge-val" style={{ color: barColor }}>{value}%</span>
    </div>
  );
}

function SevBadge({ severity }) {
  const colors = { Info: '#1a73e8', Warning: '#f9ab00', Average: '#e37400', High: '#ea4335', Disaster: '#d93025' };
  return <span className="sev-badge" style={{ color: colors[severity] || '#9aa0a6', borderColor: colors[severity] || '#9aa0a6' }}>{severity}</span>;
}

export default function ServerMetrics() {
  const [serversQ, problemsQ, networkQ] = useQueries({
    queries: [
      { queryKey: ['zabbix', 'servers'], queryFn: () => fetch(`${BASE}/zabbix/servers`).then(r => r.json()), refetchInterval: 60000, select: (d) => unwrap(d)?.servers || [] },
      { queryKey: ['zabbix', 'problems'], queryFn: () => fetch(`${BASE}/zabbix/problems`).then(r => r.json()), refetchInterval: 60000, select: (d) => unwrap(d)?.problems || [] },
      { queryKey: ['zabbix', 'network'], queryFn: () => fetch(`${BASE}/zabbix/network`).then(r => r.json()), refetchInterval: 60000, select: unwrap },
    ],
  });
  const servers = serversQ.data || [];
  const problems = problemsQ.data || [];
  const network = networkQ.data;

  if (serversQ.isPending || problemsQ.isPending || networkQ.isPending) {
    return <div className="page-loading"><div className="spinner" /><span>Loading server metrics...</span></div>;
  }

  return (
    <div className="metrics-page page-enter">
      <ZabbixProblemStream />
      {/* Network overview bar */}
      {network && (
        <div className="net-overview">
          <div className="net-stat">
            <span className="net-stat-val">{network.total}</span>
            <span className="net-stat-label">Total Hosts</span>
          </div>
          <div className="net-stat">
            <span className="net-stat-val net-up">{network.available}</span>
            <span className="net-stat-label">Online</span>
          </div>
          <div className="net-stat">
            <span className="net-stat-val net-down">{network.unavailable}</span>
            <span className="net-stat-label">Offline</span>
          </div>
          <div className="net-stat">
            <span className="net-stat-val">{network.unknown}</span>
            <span className="net-stat-label">Unknown</span>
          </div>
        </div>
      )}

      {/* Server cards */}
      <div className="server-grid">
        {servers.map(s => (
          <div key={s.hostid} className={`server-card ${s.available === false ? 'server-offline' : s.cpu >= 80 || s.memory >= 90 ? 'server-warn' : ''}`}>
            <div className="server-header">
              <span className="server-name">
                <span className={`status-dot ${s.available === false ? 'inactive' : 'active'}`} />{' '}
                {s.name}
              </span>
              {s.available === false && <span className="server-offline-badge">OFFLINE</span>}
              {s.available !== false && <span className="server-group">{s.group}</span>}
            </div>
            <div className="server-ip">{s.ip}</div>
            <div className="server-gauges">
              <GaugeBar value={s.cpu} label="CPU" color="#1a73e8" />
              <GaugeBar value={s.memory} label="MEM" color="#8430ce" />
              <GaugeBar value={s.disk_pused} label="DISK" color="#e37400" warn={80} crit={95} />
            </div>
            <div className="server-meta">
              {s.load1 !== null && <span>Load: {s.load1}</span>}
              {s.uptime !== null && <span>Up: {formatUptime(s.uptime)}</span>}
              {s.mem_total !== null && <span>RAM: {formatBytes(s.mem_total)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Problems */}
      {problems.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Active Problems ({problems.length})</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Severity</th><th>Host</th><th>Problem</th><th>Time</th></tr></thead>
              <tbody>
                {problems.slice(0, 30).map((p, i) => (
                  <tr key={i}>
                    <td><SevBadge severity={p.severity} /></td>
                    <td><span className="badge badge-agent">{p.host}</span></td>
                    <td>{p.name}</td>
                    <td className="dim">{new Date(p.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
