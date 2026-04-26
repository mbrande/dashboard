import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingAlerts, acknowledgeAlerts } from '../api/alerts';

const SEEN_KEY = 'dashboard_seen_alerts';
export const alertsKey = ['alerts', 'pending'];

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

function fireNotification(alert) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(alert.title, {
      body: alert.body || '',
      icon: '/dashboard/logo192.png',
      tag: alert.id,
      requireInteraction: alert.severity === 'critical'
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

function selectAlerts(data) {
  const result = Array.isArray(data) ? data[0] : data;
  return result?.alerts || [];
}

export function useAlerts() {
  const qc = useQueryClient();
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const seenRef = useRef(getSeen());

  const { data: alerts = [] } = useQuery({
    queryKey: alertsKey,
    queryFn: fetchPendingAlerts,
    select: selectAlerts,
    refetchInterval: () => (document.hidden ? 300000 : 90000),
    refetchIntervalInBackground: true,
  });

  // Fire a browser Notification for each unseen alert id.
  useEffect(() => {
    const seen = seenRef.current;
    let changed = false;
    for (const alert of alerts) {
      if (!seen[alert.id]) {
        fireNotification(alert);
        seen[alert.id] = Date.now();
        changed = true;
      }
    }
    if (changed) setSeen(seen);
  }, [alerts]);

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlerts,
    onMutate: async (ids) => {
      // Optimistic: drop acked rows from the cache so the UI updates instantly.
      await qc.cancelQueries({ queryKey: alertsKey });
      const prev = qc.getQueryData(alertsKey);
      qc.setQueryData(alertsKey, (old) => {
        const result = Array.isArray(old) ? old[0] : old;
        if (!result?.alerts) return old;
        const next = { ...result, alerts: result.alerts.filter(a => !ids.includes(a.id)) };
        return Array.isArray(old) ? [next] : next;
      });
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(alertsKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: alertsKey }),
  });

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const markRead = useCallback((ids) => ackMutation.mutate(ids), [ackMutation]);
  const clearAll = useCallback(() => {
    const ids = alerts.map(a => a.id);
    if (ids.length > 0) ackMutation.mutate(ids);
  }, [alerts, ackMutation]);

  return {
    alerts,
    unread: alerts.length,
    permission,
    requestPermission,
    markRead,
    clearAll,
  };
}
