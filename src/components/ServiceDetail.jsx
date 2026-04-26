import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

const STATUS_COLOR = { up: '#34a853', auth: '#f9ab00', down: '#d93025' };
const STATUS_LABEL = { up: 'UP', auth: 'AUTH', down: 'DOWN' };

function fmtAge(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function fmtTickTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function uptimeClass(pct) {
  if (pct == null) return '';
  if (pct >= 99.5) return 'good';
  if (pct >= 95) return 'warn';
  return 'bad';
}

function UptimePill({ label, pct }) {
  return (
    <div className="svc-uptime-pill">
      <span className="svc-uptime-pill-label">{label}</span>
      <span className={`svc-uptime-pill-val svc-uptime-${uptimeClass(pct)}`}>
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

// Status timeline strip: colored segments along the time axis.
function StatusStrip({ points }) {
  if (!points || points.length === 0) return null;
  const t0 = points[0].ts;
  const tN = points[points.length - 1].ts;
  const span = Math.max(1, tN - t0);
  return (
    <div className="svc-status-strip">
      {points.map((p, i) => {
        const next = points[i + 1] ? points[i + 1].ts : tN + 60_000;
        const left = ((p.ts - t0) / span) * 100;
        const width = ((next - p.ts) / span) * 100;
        return (
          <div
            key={p.ts}
            className="svc-status-segment"
            style={{
              left: `${left}%`, width: `${width}%`,
              backgroundColor: STATUS_COLOR[p.status] || '#9aa0a6'
            }}
            title={`${new Date(p.ts).toLocaleTimeString()} — ${STATUS_LABEL[p.status]}`}
          />
        );
      })}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#fff', border: '1px solid #e0e0e0',
  borderRadius: 8, fontSize: '0.75rem'
};

function LatencyChart({ points }) {
  if (!points || points.length < 2) return <div className="svc-empty">Not enough data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#1a73e8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
        <XAxis
          dataKey="ts"
          tickFormatter={fmtTickTime}
          tick={{ fontSize: 10 }}
          stroke="#9aa0a6"
        />
        <YAxis
          tickFormatter={(v) => `${v}ms`}
          tick={{ fontSize: 10 }}
          stroke="#9aa0a6"
          width={50}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(ms) => new Date(ms).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          formatter={(v) => [v == null ? '—' : `${v}ms`, 'latency']}
        />
        <Area
          type="monotone"
          dataKey="latency_ms"
          stroke="#1a73e8"
          fill="url(#latGrad)"
          strokeWidth={1.5}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function IncidentList({ incidents }) {
  if (!incidents || incidents.length === 0) {
    return <div className="svc-empty">No incidents in the last 24 hours.</div>;
  }
  return (
    <div className="svc-incident-list">
      {incidents.map((i, idx) => (
        <div key={idx} className={`svc-incident svc-incident-${i.status}`}>
          <div className="svc-incident-bar" style={{ backgroundColor: STATUS_COLOR[i.status] }} />
          <div className="svc-incident-row">
            <span className="svc-incident-status">{STATUS_LABEL[i.status]}</span>
            <span className="svc-incident-time">{fmtTime(i.started_at)}</span>
            <span className="svc-incident-duration">{fmtAge(i.duration_s)}</span>
          </div>
          <div className="svc-incident-meta">
            {i.error && <span className="svc-incident-error">{i.error}</span>}
            {i.http_code && <span className="svc-incident-code">HTTP {i.http_code}</span>}
            <span className="svc-incident-samples">{i.sample_count} sample{i.sample_count === 1 ? '' : 's'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ServiceDetail() {
  const { name: encodedName } = useParams();
  const navigate = useNavigate();
  const name = decodeURIComponent(encodedName);

  // Pull current status + url from the main /services/health response.
  const { data: live } = useQuery({
    queryKey: ['services', 'health'],
    queryFn: () => fetch(`${BASE}/services/health`).then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const current = useMemo(
    () => (live?.services || []).find(s => s.name === name),
    [live, name]
  );

  // Pull this service's history.
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['services', 'history', name],
    queryFn: () =>
      fetch(`${BASE}/services/history?name=${encodeURIComponent(name)}&hours=24`)
        .then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const openLink = () => {
    if (current?.url) window.open(current.url, '_blank', 'noopener,noreferrer');
  };

  if (isPending) {
    return <div className="page-loading"><div className="spinner" /><span>Loading {name} history...</span></div>;
  }
  if (error) {
    return (
      <div className="page-error">
        <p>Unable to load history</p>
        <p className="error-detail">{error.message}</p>
        <button className="btn" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="services-page page-enter">
      <div className="page-toolbar">
        <div className="live-indicator">
          <button className="btn btn-outline svc-back" onClick={() => navigate('/services')}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Services
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
          {current?.url && (
            <button className="btn" onClick={openLink}>
              Open Service ↗
            </button>
          )}
        </div>
      </div>

      <div className="svc-detail-header">
        <div className="svc-detail-title">
          <h1>{name}</h1>
          {current && (
            <span className={`svc-detail-status svc-${current.status}`}>
              {STATUS_LABEL[current.status]}
              {current.http_code ? ` · HTTP ${current.http_code}` : ''}
              {current.latency_ms != null ? ` · ${current.latency_ms}ms` : ''}
            </span>
          )}
        </div>
        <div className="svc-detail-uptime-row">
          <UptimePill label="1h" pct={data.uptime_1h_pct} />
          <UptimePill label="24h" pct={data.uptime_24h_pct} />
          <UptimePill label="7d" pct={data.uptime_7d_pct} />
          <div className="svc-uptime-pill">
            <span className="svc-uptime-pill-label">avg 24h</span>
            <span className="svc-uptime-pill-val">
              {data.avg_latency_24h_ms != null ? `${data.avg_latency_24h_ms}ms` : '—'}
            </span>
          </div>
          <div className="svc-uptime-pill">
            <span className="svc-uptime-pill-label">samples 7d</span>
            <span className="svc-uptime-pill-val">
              {data.sample_count_7d?.toLocaleString() || '0'}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Latency (last {data.hours}h)</h2>
        <LatencyChart points={data.points} />
        <div className="svc-status-strip-wrap">
          <div className="svc-status-strip-label">Status timeline</div>
          <StatusStrip points={data.points} />
        </div>
      </div>

      <div className="card">
        <h2>Incidents (last {data.hours}h)</h2>
        <IncidentList incidents={data.incidents} />
      </div>
    </div>
  );
}
