import React, { useState, useCallback } from 'react';
import { useSSE } from '../hooks/useSSE';

// Global toast container — one per app. Listens for `new_devices` SSE events
// and pops a banner in the top-right for each new host discovered.
export default function NewDeviceToast() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  useSSE('new_devices', (data) => {
    const arr = Array.isArray(data) ? data : [];
    if (arr.length === 0) return;
    setToasts(prev => {
      const next = [...prev];
      for (const d of arr) {
        const id = `${d.hostid}-${d.first_seen}`;
        if (next.find(x => x.id === id)) continue;
        next.push({ id, name: d.name, ip: d.ip, first_seen: d.first_seen });
        setTimeout(() => dismiss(id), 15_000); // auto-dismiss in 15s
      }
      return next.slice(-6);
    });
  });

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className="toast toast-info">
          <div className="toast-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div className="toast-body">
            <div className="toast-title">New device on network</div>
            <div className="toast-detail">
              <strong>{t.name}</strong>
              <span style={{ marginLeft: 6, opacity: 0.8 }}>{t.ip}</span>
            </div>
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
