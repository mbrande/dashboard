// Dashboard push-sender sidecar.
//
// Tiny HTTP service that the n8n Alert System workflow calls when it needs to
// fire a Web Push notification. We do this in Node (not n8n directly) because
// VAPID JWT signing and the per-message ECDH/HKDF/AES-GCM payload encryption
// are non-trivial in n8n's Code node sandbox; the `web-push` npm package does
// it in one call.
//
// Endpoints:
//   POST /send       body: { subscription, payload, ttl?, urgency? }
//                    payload becomes the notification (title/body/data).
//                    Returns 200 on success; 410 if the subscription is gone
//                    (n8n should delete it from MySQL on a 410).
//   POST /send-many  body: { subscriptions: [...], payload }
//                    Sends to all in parallel. Returns per-sub results so n8n
//                    can clean up dead endpoints in one round-trip.
//   GET  /health     trivial liveness probe.
//
// Configuration via env vars:
//   PUSH_PORT       (default 8766)
//   PUSH_VAPID_PUBLIC, PUSH_VAPID_PRIVATE, PUSH_VAPID_SUBJECT (mailto:... or URL)
//   PUSH_AUTH_TOKEN (optional shared secret; if set, requests must include
//                    `X-Auth-Token: <secret>`)

const http = require('http');
const webpush = require('web-push');

const PORT = Number(process.env.PUSH_PORT || 8766);
const VAPID_PUBLIC = process.env.PUSH_VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.PUSH_VAPID_PRIVATE;
const VAPID_SUBJECT = process.env.PUSH_VAPID_SUBJECT || 'mailto:postmaster@invalid.example';
const AUTH_TOKEN = process.env.PUSH_AUTH_TOKEN || null;

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('FATAL: PUSH_VAPID_PUBLIC and PUSH_VAPID_PRIVATE must be set');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 64 * 1024) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function deliverOne(subscription, payload, opts = {}) {
  const stringPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sendOpts = {
    TTL: opts.ttl ?? 60 * 60 * 24,        // 1d default
    urgency: opts.urgency || 'normal',
  };
  try {
    const result = await webpush.sendNotification(subscription, stringPayload, sendOpts);
    return { ok: true, statusCode: result.statusCode, endpoint: subscription.endpoint };
  } catch (err) {
    // 404 and 410 mean the subscription is permanently gone — caller should delete.
    const sc = err.statusCode || null;
    return {
      ok: false,
      statusCode: sc,
      endpoint: subscription.endpoint,
      gone: sc === 404 || sc === 410,
      error: err.body || err.message || String(err),
    };
  }
}

const server = http.createServer(async (req, res) => {
  if (AUTH_TOKEN && req.headers['x-auth-token'] !== AUTH_TOKEN) {
    return send(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/send') {
    try {
      const body = await readJson(req);
      if (!body.subscription) return send(res, 400, { error: 'subscription required' });
      const result = await deliverOne(body.subscription, body.payload || {}, body);
      return send(res, result.ok ? 200 : (result.gone ? 410 : 502), result);
    } catch (e) {
      return send(res, 400, { error: 'bad json: ' + e.message });
    }
  }

  if (req.method === 'POST' && req.url === '/send-many') {
    try {
      const body = await readJson(req);
      const subs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
      const payload = body.payload || {};
      const results = await Promise.all(subs.map(s => deliverOne(s, payload, body)));
      const summary = {
        total: results.length,
        ok: results.filter(r => r.ok).length,
        gone: results.filter(r => r.gone).length,
        failed: results.filter(r => !r.ok && !r.gone).length,
      };
      return send(res, 200, { summary, results });
    } catch (e) {
      return send(res, 400, { error: 'bad json: ' + e.message });
    }
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[push-sender] listening on :${PORT}, vapid subject=${VAPID_SUBJECT}, auth=${AUTH_TOKEN ? 'on' : 'off'}`);
});
