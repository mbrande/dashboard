const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const fetchPendingAlerts = () =>
  fetch(`${BASE}/alerts/pending`).then(r => r.json());

export const acknowledgeAlerts = (ids) =>
  fetch(`${BASE}/alerts/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  }).then(r => r.json());
