import React from 'react';

export default function AgentStatusBar({ data }) {
  if (!data) return null;

  return (
    <div className="card">
      <h2>Agents</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#22c55e' }}>{data.agents_active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.agent_count}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>
    </div>
  );
}
