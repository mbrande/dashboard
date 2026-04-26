// Daily AI briefing endpoints (n8n).
const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const fetchBriefingToday = () =>
  fetch(`${BASE}/briefing/today`).then(r => r.json());

export const dismissBriefing = () =>
  fetch(`${BASE}/briefing/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then(r => r.json());

export const generateBriefing = () =>
  fetch(`${BASE}/briefing/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then(r => r.json());
