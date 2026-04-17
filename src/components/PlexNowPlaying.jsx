import React, { useState, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';

function pct(offset, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (offset / total) * 100));
}

function fmtTime(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
}

export default function PlexNowPlaying() {
  const [data, setData] = useState(null);
  const [, setTick] = useState(0);

  // Advance the progress bar smoothly between broadcasts (once per second).
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useSSE('plex_sessions', (payload) => {
    setData(payload);
  });

  // If channel is disabled (no token), nothing to show.
  if (!data) return null;

  const sessions = data.sessions || [];

  return (
    <div className="card">
      <div className="zp-header">
        <h2>Plex Now Playing</h2>
        <span className="insights-subtitle">
          {sessions.length === 0 ? 'Idle' : `${sessions.length} active session${sessions.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {sessions.length === 0 ? (
        <div className="bw-ticker-empty">Nobody's watching anything right now.</div>
      ) : (
        <div className="plex-list">
          {sessions.map(s => {
            const elapsed = pct(s.viewOffset_ms, s.duration_ms);
            return (
              <div key={s.key} className="plex-row">
                <div className="plex-row-top">
                  <span className={`plex-state plex-state-${s.state}`}>{s.state}</span>
                  <span className="plex-title">{s.title}</span>
                  {s.year && <span className="plex-year">({s.year})</span>}
                </div>
                <div className="plex-row-meta">
                  <span className="plex-user">{s.user}</span>
                  <span className="plex-sep">·</span>
                  <span className="plex-player">{s.player}{s.device ? ` (${s.device})` : ''}</span>
                  {s.transcoding && (
                    <>
                      <span className="plex-sep">·</span>
                      <span className="plex-transcode">
                        transcode {s.transcoding.video}/{s.transcoding.audio}
                      </span>
                    </>
                  )}
                </div>
                <div className="plex-progress-track">
                  <div className="plex-progress-bar" style={{ width: `${elapsed}%` }} />
                </div>
                <div className="plex-time">
                  {fmtTime(s.viewOffset_ms)} / {fmtTime(s.duration_ms)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
