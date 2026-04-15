import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

function formatBits(bps) {
  if (!bps && bps !== 0) return '—';
  const abs = Math.abs(bps);
  if (abs >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (abs >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (abs >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

function TrafficChart({ data, title }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => formatBits(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(v, name) => [formatBits(v), name]}
            labelStyle={{ color: '#202124', fontWeight: 500 }}
            contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e0e0e0' }}
          />
          <Area type="monotone" dataKey="in" name="Inbound" stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.1} strokeWidth={2} />
          <Area type="monotone" dataKey="out" name="Outbound" stroke="#34a853" fill="#34a853" fillOpacity={0.1} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeviceTrafficPanel({ devices }) {
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const handleClick = (device) => {
    if (selected === device.hostid) {
      setSelected(null);
      setHistory([]);
      return;
    }
    setSelected(device.hostid);
    setHistLoading(true);
    fetch(`${BASE}/zabbix/device-history?hostid=${device.hostid}`)
      .then(r => r.json())
      .then(d => {
        const result = Array.isArray(d) ? d[0] : d;
        setHistory(result?.history || []);
        setHistLoading(false);
      })
      .catch(() => setHistLoading(false));
  };

  return (
    <div className="card">
      <h2>Device Traffic ({devices.length})</h2>
      <div className="device-traffic-list">
        {devices.map(d => {
          const total = d.in_bps + d.out_bps;
          const maxTotal = devices[0] ? devices[0].in_bps + devices[0].out_bps : 1;
          const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          const shortName = d.name.replace('.home.arpa', '');
          const isSelected = selected === d.hostid;
          return (
            <div key={d.hostid}>
              <div className={`dt-row dt-clickable ${isSelected ? 'dt-selected' : ''}`} onClick={() => handleClick(d)}>
                <div className="dt-bar-bg">
                  <div className="dt-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="dt-info">
                  <div className="dt-name-row">
                    <span className="dt-name">{shortName}</span>
                    <span className="dt-ip mono dim">{d.ip}</span>
                  </div>
                  <div className="dt-speeds">
                    <span className="dt-in">&#9660; {formatBits(d.in_bps)}</span>
                    <span className="dt-out">&#9650; {formatBits(d.out_bps)}</span>
                    <span className="dt-total">{formatBits(total)}</span>
                  </div>
                </div>
              </div>
              {isSelected && (
                <div className="dt-chart">
                  {histLoading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }} /></div>}
                  {!histLoading && history.length > 0 && (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tickFormatter={v => formatBits(v)} tick={{ fontSize: 10 }} width={60} />
                        <Tooltip
                          formatter={(v, name) => [formatBits(v), name]}
                          contentStyle={{ fontSize: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}
                        />
                        <Area type="monotone" dataKey="in" name="In" stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.1} strokeWidth={1.5} />
                        <Area type="monotone" dataKey="out" name="Out" stroke="#34a853" fill="#34a853" fillOpacity={0.1} strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  {!histLoading && history.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-dim)', fontSize: '0.8rem' }}>No history data available</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NetworkDashboard() {
  const [router, setRouter] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [devices, setDevices] = useState([]);
  const [routerStats, setRouterStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch(`${BASE}/zabbix/router`).then(r => r.json()),
        fetch(`${BASE}/zabbix/router-interfaces`).then(r => r.json()),
        fetch(`${BASE}/zabbix/router-traffic`).then(r => r.json()),
        fetch(`${BASE}/zabbix/device-traffic`).then(r => r.json()),
        fetch(`${BASE}/zabbix/router-stats`).then(r => r.json())
      ]).then(([r, ifaces, t, dt, rs]) => {
        const rd = Array.isArray(r) ? r[0] : r;
        const id = Array.isArray(ifaces) ? (ifaces[0]?.interfaces || ifaces) : (ifaces?.interfaces || []);
        const td = Array.isArray(t) ? (t[0]?.history || t) : (t?.history || []);
        const dd = Array.isArray(dt) ? (dt[0]?.devices || dt) : (dt?.devices || []);
        const rsh = Array.isArray(rs) ? (rs[0]?.history || rs) : (rs?.history || []);
        setRouter(rd);
        setInterfaces(Array.isArray(id) ? id : []);
        setTraffic(Array.isArray(td) ? td : []);
        setDevices(Array.isArray(dd) ? dd : []);
        setRouterStats(Array.isArray(rsh) ? rsh : []);
        setError(null);
        setLoading(false);
      }).catch(err => {
        setError(err.message);
        setLoading(false);
      });
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /><span>Loading network data...</span></div>;
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Unable to load network data</p>
        <p className="error-detail">{error}</p>
        <p className="dim" style={{ marginTop: 8 }}>
          Requires n8n webhooks: <code>/zabbix/router</code>, <code>/zabbix/router-interfaces</code>, <code>/zabbix/router-traffic</code>
        </p>
      </div>
    );
  }

  return (
    <div className="network-page page-enter">
      {/* Router overview */}
      {router && (
        <>
          <div className="net-router-header">
            <div className="net-router-name">
              <span className={`status-dot ${router.status === '1' || router.status === 'up' ? 'active' : 'inactive'}`} />
              <span>{router.name || 'Synology Router'}</span>
            </div>
            {router.ip && <span className="dim mono">{router.ip}</span>}
          </div>

          <div className="net-overview">
            <div className="net-stat">
              <span className="net-stat-val">{router.cpu != null ? `${router.cpu}%` : '—'}</span>
              <span className="net-stat-label">CPU</span>
            </div>
            <div className="net-stat">
              <span className="net-stat-val">{router.memory != null ? `${router.memory}%` : '—'}</span>
              <span className="net-stat-label">Memory</span>
            </div>
            <div className="net-stat">
              <span className="net-stat-val">{router.load1 != null ? router.load1 : '—'}</span>
              <span className="net-stat-label">Load (1m)</span>
            </div>
            <div className="net-stat">
              <span className="net-stat-val">{router.firmware || '—'}</span>
              <span className="net-stat-label">Firmware</span>
            </div>
          </div>
        </>
      )}

      {/* WAN traffic chart + Router CPU/Memory */}
      <div className="chart-row">
        <div className="chart-main">
          <TrafficChart data={traffic} title="WAN Traffic" />
        </div>
        <div className="chart-side">
          {routerStats.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2>Router CPU & Memory</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={routerStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip
                    formatter={(v, name) => [`${v}%`, name]}
                    contentStyle={{ fontSize: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '0.7rem', paddingTop: 4 }} />
                  <Area type="monotone" dataKey="cpu" name="CPU" stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.1} strokeWidth={2} connectNulls />
                  <Area type="monotone" dataKey="memory" name="Memory" stroke="#8430ce" fill="#8430ce" fillOpacity={0.1} strokeWidth={2} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="two-col">
        {/* Router interfaces */}
        {interfaces.length > 0 && (
          <div className="card">
            <h2>Router Interfaces ({interfaces.length})</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.map((iface, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 500, color: '#202124' }}>{iface.name}</span>
                      </td>
                      <td>
                        <span className={`status-dot ${iface.status === 'up' ? 'active' : 'inactive'}`} />
                        {' '}{iface.status}
                      </td>
                      <td className="mono">{iface.in_bps != null ? formatBits(iface.in_bps) : '—'}</td>
                      <td className="mono">{iface.out_bps != null ? formatBits(iface.out_bps) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Device traffic */}
        {devices.length > 0 && (
          <DeviceTrafficPanel devices={devices} />
        )}
      </div>
    </div>
  );
}
