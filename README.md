# Home Dashboard

Homelab monitoring and news aggregation dashboard with real-time security, server metrics, network monitoring, DNS filtering insights, AI-curated news feeds, voice assistant, and an alert notification system.

## Features

- **Security** — Wazuh integration: critical insights, failed auth tracking, live alert feed, FIM by agent charts, agent drill-down with SCA/ports/processes, top triggered rules
- **Server Metrics** — Zabbix integration: CPU/memory/disk gauges per server, online/offline status, active problems list, network host overview
- **Network** — Synology router SNMP monitoring: WAN traffic charts, per-interface status, per-device bandwidth with expandable history charts, Pi-hole DNS stats from 2 servers
- **News** — AI-curated feeds across 4 topics (AI, Music, Computers, Tech): 33+ sources from RSS + Reddit, OpenAI-powered summaries and relevance scoring, article saving, AI chatbot
- **Voice Assistant** — Tap mic, ask questions in natural voice, get spoken answers. Uses Whisper for speech-to-text, GPT-4o-mini for intelligence, OpenAI Nova TTS for voice. Has access to all dashboard data.
- **Alerts** — Threshold-based notifications: disk >90%, server offline, security events, failed auth spikes. Bell icon with badge, slide-out drawer, browser Notification API
- **Dark Mode** — System-aware theme toggle with localStorage persistence
- **PWA** — Installable on iPhone/Mac as a standalone app

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                       │
│                                                                             │
│   User (Browser/PWA)  ──── Cloudflare Tunnel ──── dashboard.thisaimachine.com│
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────────────┐
│                          HOME NETWORK                                       │
│                                                                             │
│  ┌─────────────────────┐         ┌──────────────────────────────────┐       │
│  │   webdev (0.32)     │         │   n8n / ubuntu-vm (0.171)       │       │
│  │   Apache + React    │◄────────│   cloudflared                    │       │
│  │   Dashboard UI      │         │   n8n workflows                  │       │
│  └────────┬────────────┘         └──────┬──────┬──────┬────────────┘       │
│           │                             │      │      │                     │
│           │  ┌──────────────────────────┘      │      └────────────┐       │
│           │  │                                  │                   │       │
│  ┌────────▼──▼─────────┐  ┌───────────────────▼──┐  ┌────────────▼──┐    │
│  │ n8n Webhook API     │  │  OpenAI API          │  │ Reddit/RSS    │    │
│  │                     │  │  - GPT-4o-mini       │  │ - 33+ feeds   │    │
│  │ /zabbix/*           │  │  - Whisper (STT)     │  │ - Hourly      │    │
│  │ /wazuh/*            │  │  - TTS (Nova voice)  │  │               │    │
│  │ /news/*             │  └──────────────────────┘  └───────────────┘    │
│  │ /alerts/*           │                                                  │
│  │ /pihole/*           │                                                  │
│  │ /dashboard/ask      │                                                  │
│  │ /dashboard/transcribe│                                                 │
│  │ /dashboard/speak    │                                                  │
│  └──┬────┬────┬────┬───┘                                                  │
│     │    │    │    │                                                       │
│     │    │    │    └──────────────────────────────────┐                    │
│     │    │    └───────────────────────┐               │                    │
│     │    └────────────┐               │               │                    │
│     │                 │               │               │                    │
│  ┌──▼──────────┐  ┌──▼────────┐  ┌──▼──────────┐  ┌▼───────────────┐    │
│  │ Zabbix 7.0  │  │ Wazuh     │  │ MySQL       │  │ Pi-hole x2     │    │
│  │ netmon      │  │ security  │  │ home DB     │  │ 0.225 + 0.125  │    │
│  │ (0.150)     │  │ (0.223)   │  │             │  │                 │    │
│  └──┬──────────┘  └──┬────────┘  │ news_*      │  │ DNS filtering   │    │
│     │                │           │ wazuh_*     │  │ query stats     │    │
│     │                │           │ pending_*   │  │ blocked domains │    │
│     │                │           └─────────────┘  └─────────────────┘    │
│     │                │                                                    │
│     ▼                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │                    MONITORED HOSTS                               │      │
│  │                                                                  │      │
│  │  Router (0.1)      blackbox (0.55)     LivingRoomPC (0.56)     │      │
│  │  Mac Studio (0.151) Win11VM (0.83)     piholemini (0.125)      │      │
│  │  webdev (0.32)     n8n (0.171)         wowserver (0.210)       │      │
│  │  plex (0.222)      security (0.223)    pihole (0.225)          │      │
│  │  TheVault (0.21)   netmon (0.150)                               │      │
│  └─────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────────────── REAL-TIME MONITORING ────────────────────────────┐
│                                                                          │
│  Zabbix Agents (14 hosts)                                               │
│    ├── CPU, Memory, Disk, Uptime, Load ──► Zabbix Server               │
│    └── Network traffic (net.if.in/out) ──► Zabbix Server               │
│                                               │                          │
│  Synology Router (SNMP)                       │                          │
│    ├── Interface traffic ─────────────────────┤                          │
│    └── CPU, Memory, Load ─────────────────────┤                          │
│                                               │                          │
│  Wazuh Agents (11 hosts)                      │                          │
│    ├── Security alerts ──► Wazuh Manager ──► Wazuh Indexer             │
│    ├── File integrity ───► Wazuh Manager ──► MySQL (FIM tables)        │
│    └── Auth events ──────► Wazuh Manager ──► Wazuh Indexer             │
│                                               │                          │
│  Pi-hole x2 (DNS)                             │                          │
│    ├── Query counts, block rates              │                          │
│    ├── Top clients, top blocked domains       │                          │
│    └── Per-server breakdown                   │                          │
│                                               │                          │
│              n8n Webhook API ◄────────────────┘                          │
│                    │                                                      │
│                    ▼                                                      │
│              React Dashboard (auto-refresh 60s)                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────── NEWS PIPELINE ───────────────────────────────────┐
│                                                                          │
│  RSS Feeds (8)  ──┐                                                     │
│  Reddit Subs (25) ┤── n8n Ingestion (hourly cron)                       │
│                   │     ├── Fetch all sources                            │
│                   │     ├── Deduplicate (url_hash)                       │
│                   │     └── Store in MySQL ──► news_articles table       │
│                   │                                                      │
│                   └── n8n Summarizer                                     │
│                         ├── Batch articles to OpenAI GPT-4o-mini        │
│                         ├── Generate summary, relevance score, tags     │
│                         └── Update MySQL                                │
│                                                                          │
│  News API (webhooks) ◄── MySQL                                          │
│    ├── GET /news/articles (paginated, filtered, fulltext search)        │
│    ├── GET /news/saved (bookmarked articles)                            │
│    └── POST /news/chat (AI chatbot with article context)                │
│                                                                          │
│              React Dashboard (News page with topic tabs)                 │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────── ALERT SYSTEM ────────────────────────────────────┐
│                                                                          │
│  n8n Cron (every 2 min)                                                 │
│    ├── Check Zabbix: disk >90%, servers offline                         │
│    ├── Check Wazuh: critical alerts, failed auth >10                    │
│    ├── Generate alert with hourly dedup ID                              │
│    └── INSERT IGNORE into pending_alerts                                │
│                                                                          │
│  React Dashboard                                                         │
│    ├── Polls GET /alerts/pending every 90s                              │
│    ├── Bell icon with badge count (pulses on critical)                  │
│    ├── Slide-out alert drawer with severity colors                      │
│    ├── Browser Notification API (when tab is open)                      │
│    └── POST /alerts/acknowledge to dismiss                              │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────── VOICE ASSISTANT ─────────────────────────────────┐
│                                                                          │
│  User taps mic button                                                    │
│    │                                                                     │
│    ▼                                                                     │
│  Browser MediaRecorder (captures audio)                                  │
│    │  ├── Real-time waveform visualization                              │
│    │  └── Auto-stop on 2s silence detection                             │
│    ▼                                                                     │
│  POST /dashboard/transcribe ──► OpenAI Whisper API ──► text             │
│    │                                                                     │
│    ▼                                                                     │
│  POST /dashboard/ask                                                     │
│    │  ├── Fetches: Zabbix servers, network, device traffic              │
│    │  ├── Fetches: Wazuh stats, insights, alerts                        │
│    │  ├── Fetches: Pi-hole stats                                        │
│    │  └── Sends context + question to GPT-4o-mini                       │
│    ▼                                                                     │
│  POST /dashboard/speak ──► OpenAI TTS (Nova voice) ──► audio            │
│    │                                                                     │
│    ▼                                                                     │
│  Browser plays audio + streams text word-by-word                         │
│    │                                                                     │
│    └── Auto-listens for follow-up (conversational mode)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Recharts, React Router (HashRouter) |
| **API Gateway** | n8n (webhook endpoints proxying to all backend services) |
| **Security Monitoring** | Wazuh Manager + Wazuh Indexer (Elasticsearch) |
| **Infrastructure Monitoring** | Zabbix 7.0 (agent + SNMP) |
| **DNS Filtering** | Pi-hole v6 x2 (192.168.0.225, 192.168.0.125) |
| **AI** | OpenAI GPT-4o-mini (summaries, chatbot, voice agent), Whisper (STT), TTS (Nova) |
| **Database** | MySQL (`home` database — trends, FIM, news, alerts, chat history) |
| **Web Server** | Apache on `webdev.home.arpa` (192.168.0.32) |
| **HTTPS/Access** | Cloudflare Tunnel + Apache Basic Auth |
| **Router** | Synology RT6600ax (SNMP monitored via Zabbix) |

## n8n Workflows

See [`n8n-workflows/README.md`](n8n-workflows/README.md) for full endpoint documentation.

| Workflow | Purpose |
|----------|---------|
| Zabbix Dashboard API | Server metrics, network, router, device traffic, Pi-hole stats |
| Wazuh Dashboard API | Security alerts, agents, FIM, insights, rules endpoints |
| Wazuh Dashboard Ingestion | Scheduled collection of Wazuh data into MySQL |
| News Ingestion | Hourly RSS + Reddit fetch, dedup, store in MySQL |
| News Summarizer | OpenAI summarization and relevance scoring of articles |
| News API | Articles, sources, chatbot, saved articles endpoints |
| Alert System | Threshold checks every 2 min, pending/acknowledge endpoints |
| Dashboard AI Agent | Voice assistant: transcribe, ask, speak endpoints |

## Deployment

Served as a static build from Apache, accessible via Cloudflare tunnel at `https://dashboard.thisaimachine.com/dashboard/` or locally at `http://webdev.home.arpa/dashboard/`.

```bash
npm run build
sudo cp -r build/* /var/www/html/dashboard/
```

## Configuration

- `REACT_APP_N8N_BASE_URL` in `.env` — n8n webhook base URL
- `homepage` in `package.json` — set to `/dashboard` for Apache subpath serving
- Apache Basic Auth via `/etc/apache2/.htpasswd`
- Cloudflare Tunnel configured on n8n server (ubuntu-vm)

## Monitored Hosts

| Host | IP | Monitoring |
|------|----|-----------|
| Router (Synology RT6600ax) | 192.168.0.1 | Zabbix SNMP |
| TheVault | 192.168.0.21 | Zabbix discovery |
| webdev (dashboard server) | 192.168.0.32 | Zabbix agent2 |
| blackbox | 192.168.0.55 | Zabbix agent |
| LivingRoomPC | 192.168.0.56 | Zabbix agent |
| Win11VM | 192.168.0.83 | Zabbix agent |
| piholemini | 192.168.0.125 | Zabbix agent + Pi-hole API |
| netmon (Zabbix server) | 192.168.0.150 | Zabbix agent |
| Mac Studio | 192.168.0.151 | Zabbix agentd (Homebrew) |
| n8n (ubuntu-vm) | 192.168.0.171 | Zabbix agent2 |
| wowserver | 192.168.0.210 | Zabbix agent |
| plex | 192.168.0.222 | Zabbix agent |
| security (Wazuh) | 192.168.0.223 | Zabbix agent |
| pihole | 192.168.0.225 | Zabbix agent + Pi-hole API |
