import { useEffect, useRef, useCallback } from 'react';

/**
 * Smart polling hook - refreshes faster when visible, pauses when hidden.
 * @param {Function} callback - async function to call on each refresh
 * @param {number} activeMs - interval when page is visible (default 15s)
 * @param {number} idleMs - interval when page is hidden (default 120s)
 */
export function useSmartRefresh(callback, activeMs = 15000, idleMs = 120000) {
  const intervalRef = useRef(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const start = useCallback((ms) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => cbRef.current(), ms);
  }, []);

  useEffect(() => {
    // Initial load
    cbRef.current();
    start(activeMs);

    const onVisibility = () => {
      if (document.hidden) {
        start(idleMs);
      } else {
        cbRef.current(); // refresh immediately when returning
        start(activeMs);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeMs, idleMs, start]);
}
