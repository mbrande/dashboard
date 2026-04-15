import React from 'react';

const platformIcon = (platform) => {
  switch (platform) {
    case 'windows': return 'WIN';
    case 'ubuntu':
    case 'debian': return 'LNX';
    case 'darwin': return 'MAC';
    default: return platform?.toUpperCase()?.slice(0, 3) || '?';
  }
};

export default function AgentTable({ agents }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="card">
      <h2>Agents & File Integrity</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>OS</th>
              <th>Status</th>
              <th>Total FIM</th>
              <th>Recent FIM</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.agent_id}>
                <td className="mono">{a.agent_id}</td>
                <td>{a.agent_name}</td>
                <td>
                  <span className={`badge badge-${a.platform}`}>
                    {platformIcon(a.platform)}
                  </span>
                </td>
                <td>
                  <span className={`status-dot ${a.status === 'active' ? 'active' : 'inactive'}`} />
                  {a.status}
                </td>
                <td className="mono">{a.total_fim_events?.toLocaleString() ?? '—'}</td>
                <td className="mono">{a.recent_fim_events ?? '—'}</td>
                <td className="dim">{a.last_seen ? new Date(a.last_seen).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
