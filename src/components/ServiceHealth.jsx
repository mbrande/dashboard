import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

const STATUS_LABEL = { up: 'UP', down: 'DOWN', auth: 'AUTH' };

function fmtLatency(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString();
}

function uptimeClass(pct) {
  if (pct == null) return '';
  if (pct >= 99.5) return 'good';
  if (pct >= 95) return 'warn';
  return 'bad';
}

function ServiceCard({ svc }) {
  const navigate = useNavigate();
  const onClick = () => navigate(`/services/${encodeURIComponent(svc.name)}`);
  const onOpenLink = (e) => {
    e.stopPropagation();
    window.open(svc.url, '_blank', 'noopener,noreferrer');
  };
  const tipParts = [];
  if (svc.error) tipParts.push(svc.error);
  if (svc.http_code) tipParts.push(`HTTP ${svc.http_code}`);
  if (svc.sample_count_24h != null) tipParts.push(`${svc.sample_count_24h} samples / 24h`);
  if (svc.avg_latency_24h_ms != null) tipParts.push(`24h avg ${svc.avg_latency_24h_ms}ms`);
  const tip = tipParts.join(' · ');

  const showHistory = svc.uptime_24h_pct != null || svc.last_down_at;

  return (
    <div className={`svc-card svc-${svc.status}`} onClick={onClick} title={tip}>
      <div className="svc-card-bar" />
      <button
        className="svc-card-open"
        onClick={onOpenLink}
        title={`Open ${svc.name} in new tab`}
        aria-label={`Open ${svc.name}`}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 3h7v7M10 14L21 3M5 5h6v0M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" />
        </svg>
      </button>
      <div className="svc-card-row">
        <div className="svc-card-name">{svc.name}</div>
        <div className="svc-card-status">{STATUS_LABEL[svc.status] || svc.status}</div>
      </div>
      <div className="svc-card-meta">
        <span className="svc-card-latency">{fmtLatency(svc.latency_ms)}</span>
        {svc.http_code && <span className="svc-card-code">{svc.http_code}</span>}
        {svc.error && <span className="svc-card-error">{svc.error}</span>}
      </div>
      {showHistory && (
        <div className="svc-card-history">
          {svc.uptime_24h_pct != null && (
            <span className={`svc-uptime svc-uptime-${uptimeClass(svc.uptime_24h_pct)}`}>
              {svc.uptime_24h_pct}% 24h
            </span>
          )}
          {svc.last_down_at && svc.status !== 'down' && (
            <span className="svc-last-down">last down {fmtTime(svc.last_down_at)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServiceHealth() {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['services', 'health'],
    queryFn: () => fetch(`${BASE}/services/health`).then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const groups = useMemo(() => {
    const services = data?.services || [];
    // Sort within each group: down first, then auth, then up; alphabetical secondary.
    const order = { down: 0, auth: 1, up: 2 };
    const byCat = {};
    for (const s of services) {
      const cat = s.category || 'Other';
      (byCat[cat] = byCat[cat] || []).push(s);
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name));
    }
    // Stable category order: ones with a down service first, then alpha.
    const cats = Object.keys(byCat).sort((a, b) => {
      const aDown = byCat[a].some(s => s.status === 'down');
      const bDown = byCat[b].some(s => s.status === 'down');
      if (aDown !== bDown) return aDown ? -1 : 1;
      return a.localeCompare(b);
    });
    return cats.map(c => [c, byCat[c]]);
  }, [data]);

  if (isPending) {
    return <div className="page-loading"><div className="spinner" /><span>Checking services...</span></div>;
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Unable to load service health</p>
        <p className="error-detail">{error.message}</p>
        <button className="btn" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const summary = data?.summary || { total: 0, up: 0, down: 0, auth: 0 };
  const downCount = summary.down;

  return (
    <div className="services-page page-enter">
      <div className="page-toolbar">
        <div className="live-indicator">
          <span className={`svc-summary-pill ${downCount > 0 ? 'has-down' : ''}`}>
            <strong>{summary.up}</strong>
            {summary.auth > 0 && <> + <strong>{summary.auth}</strong> auth</>}
            {' '}/ {summary.total} up
            {downCount > 0 && <> · <strong className="svc-summary-down">{downCount} down</strong></>}
          </span>
          {data?.summary?.ts && (
            <span className="toolbar-meta">Checked {fmtTime(data.summary.ts)} · refreshes every 60s</span>
          )}
        </div>
        <button className="btn btn-outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {groups.map(([cat, services]) => (
        <div key={cat} className="svc-group">
          <h2 className="svc-group-title">{cat}</h2>
          <div className="svc-grid">
            {services.map(s => <ServiceCard key={s.url} svc={s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
