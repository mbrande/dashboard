// Thin wrappers around the n8n action layer (`/actions/*`).
const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const fetchActionCatalog = () =>
  fetch(`${BASE}/actions/catalog`).then(r => r.json());

export const fetchSuppressedActions = (days = 7) =>
  fetch(`${BASE}/actions/suppressed?days=${days}`).then(r => r.json());

export const executeAction = (id, args = {}) =>
  fetch(`${BASE}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, args }),
  }).then(r => r.json());

export const recordDecision = (action_id, args, decision) =>
  fetch(`${BASE}/actions/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_id, args, decision }),
  }).then(r => r.json());
