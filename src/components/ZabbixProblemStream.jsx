import React, { useState, useRef, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';

const SEV_COLOR = {
  Disaster: '#7b1fa2',
  High: '#d93025',
  Average: '#ea4335',
  Warning: '#f9ab00',
  Information: '#1a73e8',
  Info: '#1a73e8',
  'Not classified': '#9aa0a6',
};

function sevColor(s) { return SEV_COLOR[s] || '#9aa0a6'; }
function timeAgo(ts) {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ZabbixProblemStream({ maxRows = 60 }) {
  const [events, setEvents] = useState([]);
  const [, setTick] = useState(0); // forces timeAgo re-render
  const listRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Seed with recent history on connect.
  useSSE('problems_events_seed', (data) => {
    if (!Array.isArray(data)) return;
    setEvents(data.slice(-maxRows));
  });

  // Stream new events.
  useSSE('problems_events', (data) => {
    const arr = Array.isArray(data) ? data : [];
    if (arr.length === 0) return;
    setEvents(prev => [...prev, ...arr].slice(-maxRows));
  });

  // Auto-scroll to newest.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="card">
        <div className="zp-header">
          <h2>Problem Event Stream</h2>
          <span className="insights-subtitle">No open/resolve events yet — waiting for change…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="zp-header">
        <h2>Problem Event Stream</h2>
        <span className="insights-subtitle">{events.length} events — newest at bottom</span>
      </div>
      <div className="zp-list" ref={listRef}>
        {events.map((e, i) => {
          const color = sevColor(e.problem?.severity);
          const opened = e.action === 'opened';
          return (
            <div key={`${e.at}-${i}`} className={`zp-row zp-${e.action}`}>
              <span className="zp-dot" style={{ backgroundColor: opened ? color : '#34a853' }} />
              <span className="zp-action">{opened ? 'TRIGGERED' : 'RESOLVED'}</span>
              <span className="zp-sev" style={{ color, borderColor: color }}>
                {e.problem?.severity || '?'}
              </span>
              <span className="zp-host">{e.problem?.host}</span>
              <span className="zp-name" title={e.problem?.name}>{e.problem?.name}</span>
              <span className="zp-time">{timeAgo(e.at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
