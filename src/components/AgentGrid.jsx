import React from 'react';

const platformInfo = {
  windows: { label: 'Windows', color: '#1a73e8', bg: '#e8f0fe' },
  ubuntu: { label: 'Ubuntu', color: '#137333', bg: '#e6f4ea' },
  debian: { label: 'Debian', color: '#137333', bg: '#e6f4ea' },
  darwin: { label: 'macOS', color: '#8430ce', bg: '#f3e8fd' }
};

export default function AgentGrid({ agents, onAgentClick }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="card">
      <h2>Agent Health</h2>
      <div className="agent-grid">
        {agents.map(a => {
          const pi = platformInfo[a.platform] || { label: a.platform, color: '#5f6368', bg: '#f1f3f4' };
          return (
            <div key={a.agent_id} className="agent-tile clickable" onClick={() => onAgentClick(a)}>
              <div className="agent-tile-header">
                <span className={`status-dot ${a.status === 'active' ? 'active' : 'inactive'}`} />
                <span className="agent-tile-name">{a.agent_name}</span>
                <svg className="agent-tile-arrow" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <div className="agent-tile-platform" style={{ color: pi.color, backgroundColor: pi.bg }}>
                {pi.label}
              </div>
              <div className="agent-tile-stats">
                <div className="agent-tile-stat">
                  <span className="agent-tile-val">{a.total_fim_events?.toLocaleString() ?? '0'}</span>
                  <span className="agent-tile-label">FIM Total</span>
                </div>
                <div className="agent-tile-stat">
                  <span className="agent-tile-val">{a.recent_fim_events ?? '0'}</span>
                  <span className="agent-tile-label">Recent</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
