import React, { useEffect, useRef, useState } from 'react';
import { useSSE } from '../hooks/useSSE';

function fmtBits(bps) {
  if (!bps) return '0 bps';
  const abs = Math.abs(bps);
  if (abs >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (abs >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (abs >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

export default function BandwidthTicker({ topN = 8 }) {
  const [devices, setDevices] = useState([]);
  const prevRef = useRef(new Map()); // hostid -> { in, out } for change-highlight

  useSSE('bandwidth', (payload) => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    const list = (obj?.devices || [])
      .map(d => ({
        hostid: d.hostid,
        name: d.name,
        ip: d.ip,
        in_bps: d.in_bps || 0,
        out_bps: d.out_bps || 0,
        total: (d.in_bps || 0) + (d.out_bps || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN);
    setDevices(list);
  });

  const maxTotal = devices.reduce((m, d) => Math.max(m, d.total), 0) || 1;

  return (
    <div className="card bw-ticker-card">
      <div className="bw-ticker-header">
        <h2>Live Bandwidth</h2>
        <span className="bw-ticker-sub">top {topN} · streaming every 3s</span>
      </div>
      <div className="bw-ticker-list">
        {devices.length === 0 && (
          <div className="bw-ticker-empty">Waiting for traffic data…</div>
        )}
        {devices.map(d => {
          const prev = prevRef.current.get(d.hostid) || { total: 0 };
          const delta = d.total - prev.total;
          const trending = delta > 8000 ? 'up' : delta < -8000 ? 'down' : 'flat';
          prevRef.current.set(d.hostid, { total: d.total });
          const inPct = maxTotal ? (d.in_bps / maxTotal) * 100 : 0;
          const outPct = maxTotal ? (d.out_bps / maxTotal) * 100 : 0;
          return (
            <div key={d.hostid} className="bw-row">
              <div className="bw-row-name" title={d.ip}>
                {d.name}
                {trending === 'up'   && <span className="bw-arrow bw-up">▲</span>}
                {trending === 'down' && <span className="bw-arrow bw-down">▼</span>}
              </div>
              <div className="bw-row-bars">
                <div className="bw-bar bw-bar-in"  style={{ width: `${inPct}%` }} />
                <div className="bw-bar bw-bar-out" style={{ width: `${outPct}%` }} />
              </div>
              <div className="bw-row-values">
                <span className="bw-in"  title="download">↓ {fmtBits(d.in_bps)}</span>
                <span className="bw-out" title="upload">↑ {fmtBits(d.out_bps)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
