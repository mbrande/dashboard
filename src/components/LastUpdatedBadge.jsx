import React from 'react';

export default function LastUpdatedBadge({ data, onRefresh }) {
  if (!data) return null;

  return (
    <div className="last-updated">
      <span className="dim">
        Last snapshot: {new Date(data.captured_at).toLocaleString()}
      </span>
      <button className="refresh-btn" onClick={onRefresh} title="Refresh now">
        Refresh
      </button>
    </div>
  );
}
