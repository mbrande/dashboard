import { useEffect, useRef, useState } from 'react';

// Single shared EventSource connection for the whole app.
let source = null;
let connected = false;
const subscribers = new Map(); // channel -> Set<handler>
const latest = new Map();      // channel -> { data, ts }
const connectionListeners = new Set();

function notifyConnection() {
  connectionListeners.forEach(cb => { try { cb(connected); } catch {} });
}

function ensureConnected() {
  if (source) return;
  try {
    // Same-origin SSE endpoint proxied by Apache to the local Node broadcaster.
    source = new EventSource('/dashboard/events');
    source.addEventListener('open', () => { connected = true; notifyConnection(); });
    source.addEventListener('error', () => { connected = false; notifyConnection(); });
    source.addEventListener('update', (e) => {
      try {
        const msg = JSON.parse(e.data);
        latest.set(msg.channel, { data: msg.data, ts: msg.ts });
        const set = subscribers.get(msg.channel);
        if (set) set.forEach(cb => { try { cb(msg.data, msg.ts); } catch {} });
      } catch {}
    });
  } catch {
    // If EventSource isn't available, do nothing — polling fallback still works.
  }
}

/** Subscribe to a channel. `handler(data, ts)` runs on every server push and once
 *  immediately with cached data (if we already have some). */
export function useSSE(channel, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    ensureConnected();
    let set = subscribers.get(channel);
    if (!set) { set = new Set(); subscribers.set(channel, set); }
    const cb = (data, ts) => { if (handlerRef.current) handlerRef.current(data, ts); };
    set.add(cb);

    // Seed with cached latest if present.
    const cached = latest.get(channel);
    if (cached) cb(cached.data, cached.ts);

    return () => { set.delete(cb); };
  }, [channel]);
}

/** Hook to observe SSE connection state. Returns true when the stream is open. */
export function useSSEStatus() {
  const [isConnected, setIsConnected] = useState(connected);
  useEffect(() => {
    ensureConnected();
    const cb = (c) => setIsConnected(c);
    connectionListeners.add(cb);
    return () => { connectionListeners.delete(cb); };
  }, []);
  return isConnected;
}
