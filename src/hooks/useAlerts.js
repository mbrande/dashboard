import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPendingAlerts, acknowledgeAlerts } from '../api/alerts';

const SEEN_KEY = 'dashboard_seen_alerts';

function getSeen() {
  try {
    const data = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    // Prune entries older than 24h
    const cutoff = Date.now() - 86400000;
    const pruned = {};
    for (const [id, ts] of Object.entries(data)) {
      if (ts > cutoff) pruned[id] = ts;
    }
    return pruned;
  } catch { return {}; }
}

function setSeen(seen) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const seenRef = useRef(getSeen());
  const intervalRef = useRef(null);

  const fireNotification = useCallback((alert) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(alert.title, {
        body: alert.body || '',
        icon: '/dashboard/logo192.png',
        tag: alert.id,
        requireInteraction: alert.severity === 'critical'
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchPendingAlerts();
      const result = Array.isArray(data) ? data[0] : data;
      const pending = result?.alerts || [];
      setAlerts(pending);
      setUnread(pending.length);

      // Fire notifications for unseen alerts
      const seen = seenRef.current;
      for (const alert of pending) {
        if (!seen[alert.id]) {
          fireNotification(alert);
          seen[alert.id] = Date.now();
        }
      }
      seenRef.current = seen;
      setSeen(seen);
    } catch {}
  }, [fireNotification]);

  useEffect(() => {
    load();

    // Poll every 90s when visible, pause when hidden
    const start = (ms) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(load, ms);
    };

    start(90000);

    const onVisibility = () => {
      if (document.hidden) {
        start(300000);
      } else {
        load();
        start(90000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const markRead = useCallback(async (ids) => {
    try {
      await acknowledgeAlerts(ids);
      setAlerts(prev => prev.filter(a => !ids.includes(a.id)));
      setUnread(prev => Math.max(0, prev - ids.length));
    } catch {}
  }, []);

  const clearAll = useCallback(async () => {
    const ids = alerts.map(a => a.id);
    if (ids.length > 0) await markRead(ids);
  }, [alerts, markRead]);

  return { alerts, unread, permission, requestPermission, markRead, clearAll };
}
