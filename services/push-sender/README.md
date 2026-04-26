# Dashboard Push Sender

Tiny HTTP sidecar that signs VAPID + sends Web Push notifications. The n8n
Alert System workflow POSTs here when a new alert needs to be pushed to
subscribed browsers.

## Why a sidecar?

VAPID JWT signing (ECDSA P-256) plus the per-message payload encryption
(ECDH + HKDF + AES-GCM) is non-trivial. The `web-push` npm package handles
both in one call. n8n's Code-node sandbox blocks `require('crypto')` and
doesn't expose `crypto.subtle`, so doing this in pure n8n would mean
hand-rolling ~150 lines of crypto. A 5-line wrapper around `web-push` is
much safer.

## Endpoints

- `POST /send`        — `{ subscription, payload, ttl?, urgency? }`
- `POST /send-many`   — `{ subscriptions: [...], payload, ttl?, urgency? }` — preferred for fanouts
- `GET  /health`      — liveness probe

Returns 410 when the subscription is permanently gone (so n8n can DELETE
it from `push_subscriptions`).

## One-time setup

1. Generate VAPID keys (already done — values in `/etc/dashboard-push.env`):
   ```
   npx web-push generate-vapid-keys
   ```

2. Create `/etc/dashboard-push.env` (chmod 600):
   ```
   PUSH_VAPID_PUBLIC=<public key>
   PUSH_VAPID_PRIVATE=<private key>
   PUSH_VAPID_SUBJECT=mailto:you@example.com
   PUSH_PORT=8766
   PUSH_AUTH_TOKEN=<optional shared secret>
   ```

3. Install deps:
   ```
   cd /var/www/html/home/dashboard/services/push-sender
   npm install
   ```

4. Install + enable the systemd unit:
   ```
   sudo cp dashboard-push.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now dashboard-push.service
   ```

5. Verify:
   ```
   curl http://127.0.0.1:8766/health
   ```

## Notes

- n8n container reaches it at `http://192.168.0.32:8766` (the dashboard
  server's LAN IP). Make sure the port is open on the dashboard server's
  firewall (ufw allow from 192.168.0.0/24 to any port 8766).
- The same VAPID public key is also embedded in the React build via
  `REACT_APP_VAPID_PUBLIC_KEY` so browsers can subscribe. Public key is
  not secret; private key stays here.
