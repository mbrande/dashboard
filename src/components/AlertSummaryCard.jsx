import React from 'react';

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value?.toLocaleString() ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function AlertSummaryCard({ data }) {
  if (!data) return null;

  return (
    <div className="card">
      <h2>Alert Summary</h2>
      <div className="stat-grid">
        <StatCard label="Total Alerts" value={data.total_alerts} color="#e2e8f0" />
        <StatCard label="Critical" value={data.critical_alerts} color="#ef4444" />
        <StatCard label="High" value={data.high_alerts} color="#f97316" />
        <StatCard label="Medium" value={data.medium_alerts} color="#eab308" />
      </div>
    </div>
  );
}
