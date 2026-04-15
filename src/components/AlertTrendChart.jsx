import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function AlertTrendChart({ history }) {
  if (!history || history.length === 0) return null;

  const data = history.map(row => ({
    time: new Date(row.captured_at).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }),
    total: row.total_alerts,
    critical: row.critical_alerts,
    high: row.high_alerts,
    medium: row.medium_alerts
  }));

  return (
    <div className="card">
      <h2>Alert Trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend />
          <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot={false} name="Total" />
          <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={false} name="Critical" />
          <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} dot={false} name="High" />
          <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} dot={false} name="Medium" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
