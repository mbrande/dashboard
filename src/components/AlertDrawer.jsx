import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebPush } from '../hooks/useWebPush';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const sevColors = {
  critical: 'var(--red)',
  high: '#e37400',
  medium: 'var(--yellow)',
  info: 'var(--accent)'
};

const sourceIcons = {
  zabbix: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
  ),
  wazuh: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l7 4v5c0 5.25-3.5 10-7 11.5C8.5 21 5 16.25 5 11V6l7-4z" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1" />
    </svg>
  )
};

export default function AlertDrawer({ alerts, permission, onRequestPermission, onMarkRead, onClearAll, onClose }) {
  const navigate = useNavigate();
  const push = useWebPush();

  const handleAlertClick = (alert) => {
    if (alert.url_hash) {
      navigate(alert.url_hash);
    }
    onMarkRead([alert.id]);
    onClose();
  };

  return (
    <div className="alert-drawer-overlay" onClick={onClose}>
      <div className="alert-drawer" onClick={e => e.stopPropagation()}>
        <div className="alert-drawer-header">
          <h3>Alerts {alerts.length > 0 && <span className="alert-drawer-count">{alerts.length}</span>}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {alerts.length > 0 && (
              <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={onClearAll}>
                Clear all
              </button>
            )}
            <button className="ad-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {permission === 'default' && (
          <div className="alert-permission-banner" onClick={onRequestPermission}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            </svg>
            Click to enable browser notifications
          </div>
        )}

        {push.supported && (
          <div className="alert-push-row">
            <div className="alert-push-info">
              <div className="alert-push-title">Push notifications</div>
              <div className="alert-push-sub">
                {push.subscribed
                  ? 'Active on this device — alerts arrive even when the dashboard is closed.'
                  : 'Get notifications on this device when the dashboard is closed.'}
              </div>
              {push.error && <div className="alert-push-error">{push.error}</div>}
            </div>
            <button
              className={`btn ${push.subscribed ? 'btn-outline' : ''}`}
              style={{ padding: '5px 14px', fontSize: '0.78rem' }}
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
            >
              {push.subscribed ? 'Disable' : 'Enable on this device'}
            </button>
          </div>
        )}

        <div className="alert-drawer-list">
          {alerts.length === 0 && (
            <div className="alert-drawer-empty">No alerts — all systems normal</div>
          )}
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`alert-row alert-row-${alert.severity}`}
              onClick={() => handleAlertClick(alert)}
            >
              <div className="alert-row-bar" style={{ backgroundColor: sevColors[alert.severity] || sevColors.info }} />
              <div className="alert-row-icon" style={{ color: sevColors[alert.severity] }}>
                {sourceIcons[alert.source] || sourceIcons.zabbix}
              </div>
              <div className="alert-row-content">
                <div className="alert-row-title">{alert.title}</div>
                {alert.body && <div className="alert-row-body">{alert.body}</div>}
                <div className="alert-row-meta">
                  <span className="alert-row-source">{alert.source}</span>
                  <span className="alert-row-time">{timeAgo(alert.fired_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
