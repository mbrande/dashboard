import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSSE } from '../hooks/useSSE';

// Rolling buffer cap — keep memory bounded when the feed is busy.
const MAX_ROWS = 500;

// Status → color mapping. Pi-hole v6 uses uppercase status strings like
// GRAVITY (blocked by blocklist), CACHE, FORWARDED, REGEX, DENYLIST, etc.
const STATUS_STYLE = {
  GRAVITY:           { label: 'BLOCKED',     color: '#ea4335' },
  DENYLIST:          { label: 'BLOCKED',     color: '#ea4335' },
  DENYLIST_CNAME:    { label: 'BLOCKED',     color: '#ea4335' },
  GRAVITY_CNAME:     { label: 'BLOCKED',     color: '#ea4335' },
  REGEX:             { label: 'REGEX',       color: '#d93025' },
  REGEX_CNAME:       { label: 'REGEX',       color: '#d93025' },
  FORWARDED:         { label: 'FORWARDED',   color: '#1a73e8' },
  CACHE:             { label: 'CACHE',       color: '#34a853' },
  CACHE_STALE:       { label: 'CACHE-STALE', color: '#9aa0a6' },
  RETRIED:           { label: 'RETRIED',     color: '#f9ab00' },
  RETRIED_DNSSEC:    { label: 'DNSSEC',      color: '#f9ab00' },
  SPECIAL_DOMAIN:    { label: 'SPECIAL',     color: '#9aa0a6' },
  IN_PROGRESS:       { label: 'IN_PROG',     color: '#9aa0a6' },
  DBBUSY:            { label: 'DBBUSY',      color: '#9aa0a6' },
  UNKNOWN:           { label: 'UNKNOWN',     color: '#9aa0a6' },
};

function statusMeta(status) {
  return STATUS_STYLE[status] || { label: status || '?', color: '#9aa0a6' };
}

function fmtClock(epoch) {
  const ms = Math.round(epoch * 1000);
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function PiholeLiveTail() {
  const [rows, setRows] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('all'); // all | blocked | forwarded | cached
  const [search, setSearch] = useState('');
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const append = useCallback((incoming) => {
    if (!incoming?.length || pausedRef.current) return;
    setRows(prev => {
      // Dedupe by uid, append oldest-first (server already sorted).
      const seen = new Set(prev.map(r => r.uid));
      const next = prev.slice();
      for (const q of incoming) {
        if (!seen.has(q.uid)) { next.push(q); seen.add(q.uid); }
      }
      if (next.length > MAX_ROWS) next.splice(0, next.length - MAX_ROWS);
      return next;
    });
  }, []);

  // Seed: on initial connect, broadcaster pushes 'pihole_queries_seed' with
  // a snapshot of the rolling buffer so the panel has content immediately.
  useSSE('pihole_queries_seed', (data) => {
    const arr = Array.isArray(data) ? data : [];
    setRows(arr.slice(-MAX_ROWS));
  });

  // Live: every push from the broadcaster is a batch of new queries.
  useSSE('pihole_queries', (data) => {
    const arr = Array.isArray(data) ? data : [];
    append(arr);
  });

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filter === 'blocked') r = r.filter(q => /GRAVITY|DENYLIST|REGEX/.test(q.status || ''));
    else if (filter === 'forwarded') r = r.filter(q => q.status === 'FORWARDED');
    else if (filter === 'cached') r = r.filter(q => q.status === 'CACHE' || q.status === 'CACHE_STALE');
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter(q =>
        (q.domain || '').toLowerCase().includes(s) ||
        (q.client_ip || '').includes(s) ||
        (q.client_name || '').toLowerCase().includes(s)
      );
    }
    return r;
  }, [rows, filter, search]);

  // Keep the view scrolled to the newest row unless the user scrolled up.
  const listRef = useRef(null);
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      stickToBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (paused) return;
    const el = listRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredRows, paused]);

  // Counts in the current view
  const total = rows.length;
  const blocked = rows.filter(q => /GRAVITY|DENYLIST|REGEX/.test(q.status || '')).length;

  return (
    <div className="card pihole-tail-card">
      <div className="pihole-tail-header">
        <div className="pihole-tail-title">
          <span className="pihole-tail-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </span>
          <span className="pihole-tail-heading">Pi-hole Live Queries</span>
          <span className="pihole-tail-count">{total} buffered · {blocked} blocked</span>
        </div>
        <div className="pihole-tail-controls">
          <input
            className="filter-input"
            placeholder="filter domain / IP / host"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <div className="pihole-tail-filter-group">
            {['all','blocked','forwarded','cached'].map(k => (
              <button
                key={k}
                className={`pihole-tail-pill ${filter === k ? 'active' : ''}`}
                onClick={() => setFilter(k)}
              >{k}</button>
            ))}
          </div>
          <button
            className={`feed-pause ${paused ? 'is-paused' : ''}`}
            onClick={() => setPaused(p => !p)}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div className="pihole-tail-list" ref={listRef}>
        {filteredRows.length === 0 && (
          <div className="pihole-tail-empty">
            {paused ? 'Paused.' : 'Waiting for queries…'}
          </div>
        )}
        {filteredRows.map((q) => {
          const meta = statusMeta(q.status);
          return (
            <div key={q.uid} className="pihole-tail-row">
              <span className="pihole-tail-time">{fmtClock(q.time)}</span>
              <span className="pihole-tail-source" title={q.source_ip}>{q.source}</span>
              <span className="pihole-tail-status" style={{ color: meta.color, borderColor: meta.color }}>
                {meta.label}
              </span>
              <span className="pihole-tail-type">{q.type}</span>
              <span className="pihole-tail-domain" title={q.domain}>{q.domain}</span>
              <span className="pihole-tail-client" title={q.client_name || ''}>
                {q.client_name || q.client_ip}
              </span>
              {q.reply_ms != null && (
                <span className="pihole-tail-latency">{q.reply_ms}ms</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
