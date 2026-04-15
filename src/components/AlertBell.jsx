import React from 'react';

export default function AlertBell({ unread, hasCritical, onClick }) {
  return (
    <button className="alert-bell" onClick={onClick} title={`${unread} alert${unread !== 1 ? 's' : ''}`}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span className={`alert-badge ${hasCritical ? 'alert-badge-pulse' : ''}`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
