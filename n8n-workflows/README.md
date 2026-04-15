# n8n Workflows

This directory contains exported n8n workflow JSON files that power the dashboard's backend. These workflows run on `n8n.thisaimachine.com` and serve as both documentation and backup.

## Workflow Overview

### Zabbix Dashboard API (`OlXaYyMphOSYhTF0`)
Server metrics and network monitoring endpoints.

| Endpoint | Description |
|----------|-------------|
| `GET /zabbix/servers` | CPU, memory, uptime for all monitored Linux servers |
| `GET /zabbix/problems` | Active Zabbix problems/triggers with severity |
| `GET /zabbix/network` | Host availability summary (online/offline counts) |
| `GET /zabbix/router` | Synology RT6600ax overview (CPU, memory, load, firmware) |
| `GET /zabbix/router-interfaces` | Router interface list with in/out bps |
| `GET /zabbix/router-traffic` | 3-hour WAN traffic history for charts |
| `GET /zabbix/device-traffic` | Per-server network throughput (net.if.in/out) |

**Data source:** Zabbix API at `netmon.home.arpa` (authenticates per-request with user.login).

### Wazuh Dashboard API (`7TXlLTtCu24q5Zym`)
Security data endpoints.

| Endpoint | Description |
|----------|-------------|
| `GET /wazuh/latest` | Latest snapshot from MySQL |
| `GET /wazuh/live-stats` | Live alert counts from Wazuh Indexer |
| `GET /wazuh/live-rules` | Top triggered rules from Wazuh Indexer |
| `GET /wazuh/agents` | Agent list from Wazuh Manager API |
| `GET /wazuh/trends` | Hourly alert/syscheck trends from MySQL |
| `GET /wazuh/fim` | Recent FIM events from MySQL |
| `GET /wazuh/critical-fim` | Critical file changes from MySQL |
| `GET /wazuh/insights` | Critical insights (failed auth, priv esc, CVEs, high alerts) from Wazuh Indexer |
| `GET /wazuh/fim-by-agent` | FIM event counts per agent per hour (last 24h) from MySQL |
| `GET /wazuh/agent-fim?id=X` | Per-agent FIM events |
| `GET /wazuh/agent-critical-fim?id=X` | Per-agent critical FIM |
| `GET /wazuh/agent-fim-history?id=X` | Per-agent FIM history |
| `GET /wazuh/agent-sca?id=X` | Per-agent SCA policies |
| `GET /wazuh/agent-sca-fails?id=X&policy=Y` | Per-agent SCA failures |
| `GET /wazuh/agent-ports?id=X` | Per-agent open ports |
| `GET /wazuh/agent-processes?id=X` | Per-agent running processes |
| `GET /wazuh/agent-alerts?name=X` | Per-agent alert history |

**Data sources:** MySQL (`home` database), Wazuh Manager API (`security.home.arpa:55000`), Wazuh Indexer (`security.home.arpa:9200`).

### Wazuh Dashboard Ingestion (`3LbZEDjAs-K1vBAhoujly`)
Scheduled workflow that collects Wazuh data into MySQL for historical tracking.

**Trigger:** Schedule (runs periodically).

### News Ingestion (`zODJOCXvfegswJFX`)
Hourly news aggregation from RSS feeds and Reddit.

**Trigger:** Schedule (every 60 minutes) + manual webhook at `GET /news/ingest`.

**Pipeline:**
1. Fetches all enabled sources from `news_sources` table
2. For RSS: HTTP GET → parse XML items
3. For Reddit: HTTP GET `.json` endpoint → parse `data.children`
4. Normalizes all items (title, url, url_hash, author, published_at, content_snippet)
5. Deduplicates against existing `url_hash` values in MySQL
6. Inserts new articles into `news_articles` (without AI summary — handled by News Summarizer)

**Sources:** 33 feeds across 4 topics (ai, music, computers, tech) including RSS (Simon Willison, HN, OpenAI, Anthropic, Ars Technica, The Verge, TechCrunch, Latent Space) and Reddit (r/ClaudeAI, r/ClaudeCode, r/LocalLLaMA, r/artificial, r/ChatGPTCoding, r/AI_Agents, r/cursor, r/vibecoding, r/OpenAI, r/WeAreTheMusicMakers, r/MusicProduction, r/AIMusic, r/homelab, r/selfhosted, r/technology, and more).

### News Summarizer (`724H9997cQ5wbb5s`)
Processes unsummarized articles through OpenAI.

**Trigger:** Manual webhook at `GET /news/summarize`.

**Pipeline:**
1. Selects 5 articles where `ai_summary IS NULL`
2. Sends batch to OpenAI (gpt-4o-mini) via HTTP Request with `response_format: json_object`
3. Gets back: 2-3 sentence summary, relevance score (1-10), keyword tags
4. Updates articles in MySQL

**Relevance scoring:** Strict scoring — 9-10 only for articles directly about agentic workflows, vibe coding, AI-assisted development, context/memory systems. Generic content gets 5-7.

### News API (`IQC5ugZdq95iqzz2`)
News display and chatbot endpoints.

| Endpoint | Description |
|----------|-------------|
| `GET /news/articles?topic=X&page=N&limit=N&search=X` | Paginated articles, filtered by topic/search, sorted by relevance then date. Only shows `relevance_score >= 5`. |
| `GET /news/sources` | List of all configured news sources |
| `POST /news/chat` | AI chatbot — searches articles via MySQL FULLTEXT, sends context to OpenAI gpt-4o-mini, returns answer with citations |
| `POST /news/save` | Save/unsave an article (`{ article_id, action: "save"|"unsave" }`) |
| `GET /news/saved?topic=X` | List saved articles |
| `GET /news/saved-ids` | Quick list of saved article IDs for UI state |

**Chat flow:** User message → save to `news_chat_history` → FULLTEXT search `news_articles` → build OpenAI prompt with article context → respond with citations.

## MySQL Tables (home database)

### Existing (Wazuh)
- `wazuh_snapshots`, `wazuh_agents`, `wazuh_fim_events`, `wazuh_fim_snapshots`, `wazuh_critical_fim`, `wazuh_hourly_trends`, `wazuh_rule_stats`

### News
- `news_sources` — feed URLs, type (rss/reddit), topic, enabled flag
- `news_articles` — title, url, ai_summary, ai_tags (JSON), relevance_score, url_hash (dedup). FULLTEXT index on title/ai_summary/content_snippet.
- `news_chat_history` — session-based chat messages
- `news_saved_articles` — bookmarked article IDs

## n8n Credentials Used
- **MySQL - Home DB** (`9io5uj6IpYHlzMgX`) — MySQL connection to `home` database
- **OpenAi account** (`3hmSfLDh5GvxKdKm`) — OpenAI API for summaries and chatbot
- **Wazuh API** (`Binl45738tQW2SQf`) — Wazuh Manager basic auth
- **Wazuh Indexer** (`qDp9h30lNad93Jy1`) — Wazuh Indexer basic auth
- **SerpAPI** (`Lb5I72gRCaoRMuHz`) — available for web search (not yet wired into chatbot)

## Restoring Workflows
To import a workflow from these JSON files into n8n:
```bash
curl -X POST "https://n8n.thisaimachine.com/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/workflow-name.json
```
Note: credential IDs in the JSON must match the target n8n instance.
