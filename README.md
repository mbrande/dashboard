# Home Dashboard

Security dashboard with live Wazuh integration via n8n webhooks.

## Features

- **Critical Insights** — CVEs, privilege escalation, failed auth, high severity alerts
- **Failed Logins** — source IPs, targeted users/agents, timeline
- **Live Alert Feed** — real-time alerts with EPS counter, network context
- **Top Triggered Rules** — per-agent breakdown from Wazuh Indexer
- **Agent Drill-down** — CIS compliance scores, alerts, FIM, ports, processes
- **Alert & FIM Trend Charts** — hourly activity over time

## Deployment

Served as a static build from Apache at `http://webdev.home.arpa/dashboard/`.

```bash
# Build and deploy
npm run build
sudo cp -r build/* /var/www/html/dashboard/
```

## Configuration

- `REACT_APP_N8N_BASE_URL` in `.env` — n8n webhook base URL
- `homepage` in `package.json` — set to `/dashboard` for Apache serving

## Stack

- **Frontend:** React + Recharts
- **API:** n8n webhooks (proxies to Wazuh Manager API + Wazuh Indexer)
- **Data:** MySQL (`home` database) for historical trends, Wazuh Indexer for real-time
- **Server:** Apache on `webdev.home.arpa` (192.168.0.32)
