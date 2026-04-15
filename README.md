# Home Dashboard

Homelab monitoring and news aggregation dashboard with real-time security, server metrics, network monitoring, AI-curated news feeds, and an alert notification system.

## Features

- **Security** — Wazuh integration: critical insights, failed auth tracking, live alert feed, FIM by agent charts, agent drill-down with SCA/ports/processes, top triggered rules
- **Server Metrics** — Zabbix integration: CPU/memory/disk gauges per server, online/offline status, active problems list, network host overview
- **Network** — Synology router SNMP monitoring: WAN traffic charts, per-interface status, per-device bandwidth usage across all monitored servers
- **News** — AI-curated feeds across 4 topics (AI, Music, Computers, Tech): 33 sources from RSS + Reddit, OpenAI-powered summaries and relevance scoring, article saving, AI chatbot for searching news
- **Alerts** — Threshold-based notification system: disk space, server offline, security events, failed auth spikes. Bell icon with badge count, slide-out drawer, browser Notification API
- **Dark Mode** — System-aware theme toggle with localStorage persistence
- **PWA** — Installable on iPhone/Mac as a standalone app

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Recharts, React Router (HashRouter) |
| **API Gateway** | n8n (webhook endpoints proxying to all backend services) |
| **Security Monitoring** | Wazuh Manager + Wazuh Indexer (Elasticsearch) |
| **Infrastructure Monitoring** | Zabbix 7.0 (agent + SNMP) |
| **News AI** | OpenAI GPT-4o-mini (summarization, relevance scoring, chatbot) |
| **Database** | MySQL (`home` database — trends, FIM, news articles, alerts, chat history) |
| **Web Server** | Apache on `webdev.home.arpa` (192.168.0.32) |
| **Router** | Synology RT6600ax (SNMP monitored via Zabbix) |

## n8n Workflows

See [`n8n-workflows/README.md`](n8n-workflows/README.md) for full endpoint documentation.

| Workflow | Purpose |
|----------|---------|
| Zabbix Dashboard API | Server metrics, network, router, device traffic endpoints |
| Wazuh Dashboard API | Security alerts, agents, FIM, insights, rules endpoints |
| Wazuh Dashboard Ingestion | Scheduled collection of Wazuh data into MySQL |
| News Ingestion | Hourly RSS + Reddit fetch, dedup, store in MySQL |
| News Summarizer | OpenAI summarization and relevance scoring of articles |
| News API | Article listing, search, sources, chatbot, saved articles |
| Alert System | Threshold checks every 2 min, pending/acknowledge endpoints |

## Deployment

Served as a static build from Apache at `http://webdev.home.arpa/dashboard/`.

```bash
npm run build
sudo cp -r build/* /var/www/html/dashboard/
```

## Configuration

- `REACT_APP_N8N_BASE_URL` in `.env` — n8n webhook base URL
- `homepage` in `package.json` — set to `/dashboard` for Apache subpath serving

## Monitored Hosts

| Host | IP | Monitoring |
|------|----|-----------|
| Router (Synology RT6600ax) | 192.168.0.1 | Zabbix SNMP |
| TheVault | 192.168.0.21 | Zabbix discovery |
| webdev (this server) | 192.168.0.32 | Zabbix agent2 |
| blackbox | 192.168.0.55 | Zabbix agent |
| LivingRoomPC | 192.168.0.56 | Zabbix agent |
| Win11VM | 192.168.0.83 | Zabbix agent |
| piholemini | 192.168.0.125 | Zabbix agent |
| netmon (Zabbix server) | 192.168.0.150 | Zabbix agent |
| Mac Studio | 192.168.0.151 | Zabbix agentd (Homebrew) |
| n8n (ubuntu-vm) | 192.168.0.171 | Zabbix agent2 |
| wowserver | 192.168.0.210 | Zabbix agent |
| plex | 192.168.0.222 | Zabbix agent |
| security (Wazuh) | 192.168.0.223 | Zabbix agent |
| pihole | 192.168.0.225 | Zabbix agent |
