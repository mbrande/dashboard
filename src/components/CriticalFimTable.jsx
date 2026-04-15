import React, { useState } from 'react';

export default function CriticalFimTable({ events }) {
  const [filter, setFilter] = useState('');

  if (!events || events.length === 0) {
    return (
      <div className="card">
        <h2>Critical File Changes</h2>
        <div className="empty-state">No critical file changes detected</div>
      </div>
    );
  }

  const filtered = filter
    ? events.filter(e =>
        e.agent_name?.toLowerCase().includes(filter.toLowerCase()) ||
        e.file_path?.toLowerCase().includes(filter.toLowerCase())
      )
    : events;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Critical File Changes</h2>
        <input
          type="text"
          placeholder="Filter by agent or path..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="filter-input"
        />
      </div>
      <div className="critical-hint">
        Monitoring: /etc/, /usr/bin/, /usr/sbin/, /boot/, crontabs, Windows Run keys, LaunchDaemons
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>File Path</th>
              <th>Size</th>
              <th>MD5</th>
              <th>Changed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((e, i) => (
              <tr key={i}>
                <td><span className="badge badge-agent">{e.agent_name}</span></td>
                <td className="mono file-path" title={e.file_path}>{e.file_path}</td>
                <td className="mono">{e.size ? formatSize(e.size) : '—'}</td>
                <td className="mono hash" title={e.md5}>{e.md5?.slice(0, 12) ?? '—'}</td>
                <td className="dim">{e.fim_date ? timeAgo(e.fim_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 100 && (
        <div className="table-footer">Showing 100 of {filtered.length} events</div>
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
