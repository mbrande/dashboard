# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Planned work:** see `UPGRADES.md` for three substantial features the user has approved (web push notifications, voice-assistant tool-calling, daily AI briefing). Read it before working on any of those.

## Project Overview

Home Dashboard — a React single-page app serving as a homelab monitoring hub. Sections: **Security** (Wazuh), **Server Metrics** (Zabbix), **Network** (Synology router + Pi-hole), and **News** (n8n-ingested feeds).

## Commands

- `npm start` — dev server (Create React App, port 3000)
- `npm run build` — production build
- `npm test` — run tests (Jest + React Testing Library, interactive watch mode)
- `npm test -- --watchAll=false` — run tests in CI mode
- Deploy: `npm run build && sudo cp -r build/* /var/www/html/dashboard/`

## Architecture

**Routing:** `react-router-dom` v7 with `HashRouter` (so the app works under Apache's `/dashboard/` mount without server-side rewrites). Routes are declared in `src/App.js`; `NavLink` drives the nav highlight; `useNavigate` is used for programmatic navigation (home tiles and alert clicks). The `pending_alerts.url_hash` field from n8n is fed straight into `navigate()` so alerts deep-link to the right page.

**Code-splitting:** Pages and on-demand modals are loaded with `React.lazy` + `Suspense` (`PageLoader` fallback for routes, `null` fallback for modals). Eagerly imported modules in `App.js` should stay light — anything page-specific lives in its own chunk. Pattern: `const X = lazy(() => import('./components/X'));`.

**Data fetching: TanStack Query (`@tanstack/react-query`).** The `QueryClientProvider` is set up in `src/index.js`; the shared client lives in `src/queryClient.js` (defaults: 30s `staleTime`, refetch on focus/reconnect, 1 retry). Conventions:
- One `useQuery` per endpoint, with a stable array `queryKey` (e.g. `['wazuh', 'live-feed']`).
- Polling via `refetchInterval`; pause polling with `refetchInterval: false` when the component is paused.
- Most n8n webhooks return either an object or a single-element array — use `select: (d) => Array.isArray(d) ? d[0] : d` (the local `unwrap` helper) so consumers see a uniform shape.
- For multi-endpoint pages, use `useQueries` and combine `isPending`/`error` from the array.
- Mutations (e.g. ack alerts) use `useMutation` with optimistic `onMutate` + `onSettled` invalidate.

**SSE integration:** `src/hooks/useSSE.js` keeps a single shared `EventSource` and dispatches by channel. SSE handlers feed the React Query cache via `qc.setQueryData(key, payload)` rather than mirroring data into local state — components subscribe via `useQuery` and get both polled and pushed updates uniformly. See `useWazuhData`, `LiveFeed`, `DashboardAuthEvents`, `NetworkDashboard` (Pi-hole) for the pattern.

**Alert system:** `src/hooks/useAlerts.js` polls `/alerts/pending` every 90s (300s when tab hidden), fires browser `Notification`s for unseen ids (deduped via `localStorage['dashboard_seen_alerts']`, pruned to 24h), and exposes a `markRead`/`clearAll` mutation that POSTs to `/alerts/acknowledge`. Alerts are generated server-side by the n8n "Alert System" workflow.

**Styling:** Single `App.css` file for all styles, no CSS modules or preprocessors.

**Known follow-up:** `NewsPage` still uses raw `useEffect`/`setInterval` because of its pagination + saved-toggle state — migrating to `useInfiniteQuery` is a larger refactor and was deferred.

## Environment

- `REACT_APP_N8N_BASE_URL` in `.env` — n8n webhook base URL (required)
- `homepage` in `package.json` is `/dashboard` — all builds assume serving from that subpath
- Deployed as static files under Apache on `webdev.home.arpa`

## Key Conventions

- All API endpoints go through n8n webhooks, never directly to Wazuh or Zabbix APIs
- Components are `.jsx`, hooks and API modules are `.js`
- Charts use Recharts
- New polled data should use `useQuery` with `refetchInterval`, not raw `useEffect`/`setInterval`
- New pages should be lazy-loaded in `App.js`
