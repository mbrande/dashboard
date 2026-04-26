import { useEffect, useState, useCallback } from 'react';
import { subscribePush, unsubscribePush } from '../api/webpush';

const VAPID_PUBLIC = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Register the service worker once and expose subscribe/unsubscribe controls.
// Safari/iOS requires the dashboard to be installed as a PWA; on plain browsers
// (Chrome / Firefox / Edge) it works in any tab. Each device subscribes
// separately.

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function useWebPush() {
  const [registration, setRegistration] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);

  // Register the SW once, then check current subscription state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    if (!VAPID_PUBLIC) {
      setSupported(false);
      setError('VAPID public key not configured');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/dashboard/sw.js', { scope: '/dashboard/' });
        if (cancelled) return;
        setRegistration(reg);
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSubscription(existing);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();

    // Listen for the SW asking us to navigate (notificationclick handler).
    const onMessage = (e) => {
      if (e.data?.type === 'navigate' && e.data?.hash) {
        window.location.hash = e.data.hash;
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    if (!registration) { setError('Service worker not ready'); return; }
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') {
        setError('Notification permission not granted');
        return;
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      await subscribePush(sub.toJSON(), navigator.userAgent);
      setSubscription(sub);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    if (!subscription) return;
    try {
      const ep = subscription.endpoint;
      await subscription.unsubscribe();
      await unsubscribePush(ep);
      setSubscription(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, [subscription]);

  return {
    supported,
    permission,
    subscribed: !!subscription,
    error,
    subscribe,
    unsubscribe,
  };
}
