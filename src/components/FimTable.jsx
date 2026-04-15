import React, { useState } from 'react';

export default function FimTable({ events }) {
  const [filter, setFilter] = useState('');

  if (!events || events.length === 0) return null;

  const filtered = filter
    ? events.filter(e =>
        e.agent_name?.toLowerCase().includes(filter.toLowerCase()) ||
        e.file_path?.toLowerCase().includes(filter.toLowerCase())
      )
    : events;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Recent File Changes</h2>
        <input
          type="text"
          placeholder="Filter by agent or path..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="filter-input"
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>File Path</th>
              <th>Type</th>
              <th>Size</th>
              <th>Changed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((e, i) => (
              <tr key={i}>
                <td>
                  <span className="badge badge-agent">{e.agent_name}</span>
                </td>
                <td className="mono file-path" title={e.file_path}>{e.file_path}</td>
                <td>{e.event_type}</td>
                <td className="mono">{e.size ? formatSize(e.size) : '—'}</td>
                <td className="dim">
                  {e.fim_date ? new Date(e.fim_date).toLocaleString() : '—'}
                </td>
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
