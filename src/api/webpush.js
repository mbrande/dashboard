// Web Push subscribe / unsubscribe endpoints (n8n).
const BASE = process.env.REACT_APP_N8N_BASE_URL;

export const subscribePush = (subscription, userAgent) =>
  fetch(`${BASE}/webpush/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, user_agent: userAgent }),
  }).then(r => r.json());

export const unsubscribePush = (endpoint) =>
  fetch(`${BASE}/webpush/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).then(r => r.json());
