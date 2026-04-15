# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Dashboard — a React single-page app serving as a homelab monitoring hub. Currently has two active sections: **Security** (Wazuh integration) and **Server Metrics** (Zabbix integration), with Network and Monitoring planned.

## Commands

- `npm start` — dev server (Create React App, port 3000)
- `npm run build` — production build
- `npm test` — run tests (Jest + React Testing Library, interactive watch mode)
- `npm test -- --watchAll=false` — run tests in CI mode
- Deploy: `npm run build && sudo cp -r build/* /var/www/html/dashboard/`

## Architecture

**Routing:** No router library — `App.js` uses a `tab` state (`home`, `security`, `metrics`) to switch between `HomePage`, `SecurityPage`, and `ServerMetrics` components.

**Data flow for Security page:**
- `src/api/wazuh.js` — thin fetch wrappers against n8n webhook endpoints (`REACT_APP_N8N_BASE_URL` env var). n8n proxies to Wazuh Manager API, Wazuh Indexer, and a MySQL `home` database.
- `src/hooks/useWazuhData.js` — single hook that loads all Security page data in parallel (`Promise.all`), auto-refreshes every 60s, and provides `loading`/`error`/`refresh` state.
- Components like `CriticalInsights`, `FailedLogins`, and `LiveFeed` fetch their own data independently (not through `useWazuhData`).
- `AgentDetail` is a modal that fetches per-agent data (SCA, FIM, ports, processes, alerts) on demand.

**Server Metrics page:** `ServerMetrics.jsx` is a self-contained component with its own data fetching (Zabbix data via n8n webhooks).

**Styling:** Single `App.css` file for all styles, no CSS modules or preprocessors.

## Environment

- `REACT_APP_N8N_BASE_URL` in `.env` — n8n webhook base URL (required)
- `homepage` in `package.json` is `/dashboard` — all builds assume serving from that subpath
- Deployed as static files under Apache on `webdev.home.arpa`

## Key Conventions

- All API endpoints go through n8n webhooks, never directly to Wazuh or Zabbix APIs
- Components are `.jsx`, hooks and API modules are `.js`
- Charts use Recharts
