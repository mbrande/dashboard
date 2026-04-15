import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
};

export function AlertTrendArea({ trends }) {
  if (!trends || trends.length === 0) return null;

  const data = trends.map(t => ({
    label: `${String(t.hour).padStart(2, '0')}:00`,
    total: t.total_alerts ?? t.total ?? 0,
    high: t.high_plus_alerts ?? t.high ?? 0
  }));

  return (
    <div className="card">
      <h2>Alert Activity (Hourly)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#1a73e8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ea4335" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#ea4335" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
          <XAxis dataKey="label" stroke="#9aa0a6" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9aa0a6" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#202124' }} />
          <Legend />
          <Area type="monotone" dataKey="total" stroke="#1a73e8" fill="url(#gradTotal)" strokeWidth={2} name="Total Alerts" />
          <Area type="monotone" dataKey="high" stroke="#ea4335" fill="url(#gradHigh)" strokeWidth={2} name="High+ Severity" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SyscheckTrendBar({ trends }) {
  if (!trends || trends.length === 0) return null;

  const data = trends.map(t => ({
    label: `${String(t.hour).padStart(2, '0')}:00`,
    syscheck: t.syscheck_events ?? t.syscheck ?? 0
  }));

  return (
    <div className="card">
      <h2>File Integrity Events (Hourly)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
          <XAxis dataKey="label" stroke="#9aa0a6" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9aa0a6" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#202124' }}
            cursor={{ fill: 'rgba(26,115,232,0.04)' }}
          />
          <Bar dataKey="syscheck" fill="#8ab4f8" radius={[4, 4, 0, 0]} name="Syscheck Events" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
