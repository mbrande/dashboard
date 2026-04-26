# Planned Upgrades

Roadmap for three substantial features the user picked. Each section is
self-contained so a future session can resume on any of them. Always read this
file *plus* `CLAUDE.md` plus the relevant existing code before starting work.

**Hard constraint that applies to anything AI-driven (#4 and #5):** the AI
must never take actions on its own. It always proposes the action, fully
explains what it would do, and waits for explicit user accept/deny. This
shapes the architecture for both #4 and #5 below.

---

## Cross-cutting: shared "Action Proposal" layer

Both #4 (voice tool-calling) and #5 (daily briefing) need the same primitive:
a small library of *actions* the AI can propose, plus a UI affordance for the
user to accept or deny each proposal. Build this once and reuse.

**Action descriptor (the JSON the LLM emits):**
```json
{
  "id": "ack_alerts",
  "title": "Acknowledge 4 stale Zabbix-offline alerts",
  "description": "These alerts are from yesterday's flap of LivingRoomPC. The host has been back up for 8 hours; the alerts are no longer relevant.",
  "args": { "ids": ["zabbix-offline-...", "..."] },
  "risk": "low"
}
```

- `id` matches a server-side handler (registry of allowed actions, see below).
- `title` is the one-line summary shown on the action card.
- `description` is the LLM's reasoning — must be specific, not generic.
- `args` are the parameters the handler will receive on accept.
- `risk` ∈ `low` | `medium` | `high` — drives styling and whether a
  second-confirm is needed.

**Action registry (server-side):**

A new n8n workflow exposes:
- `POST /actions/execute` — body `{ id, args }`. Looks up the action by `id`,
  validates `args` against the action's schema, runs it. Returns
  `{ ok: true, result }` or `{ ok: false, error }`.
- `GET /actions/catalog` — returns the list of registered actions with their
  schemas + risk levels (used by the LLM to know what's available).

**Action catalog (initial set — read-only and "obviously safe" first):**

Read-only:
- `list_alerts` — current pending alerts (mirrors existing endpoint)
- `list_services_down` — services currently `down`
- `get_service_history(name)` — same as the existing endpoint
- `top_blocked_domains(hours)` — Pi-hole top blocked
- `recent_failed_logins(hours)` — Wazuh failed logins

Mutating but reversible / low-risk:
- `ack_alerts(ids)` — calls existing `/alerts/acknowledge`
- `dismiss_recommendation(id)` — for #5, marks a proposed action as "don't
  suggest again for N days"

Higher-risk (require explicit second confirm):
- `restart_service(name)` — would invoke a script on the dashboard server or
  trigger an Ansible job. Out-of-scope for v1; design here, build later.
- `block_ip_at_firewall(ip)` — same.

**UI: ProposedAction component**

Reusable React component (`src/components/ProposedAction.jsx`) that renders
an action descriptor as a card with:
- Title (color-coded by risk)
- Expandable description
- "Accept" / "Dismiss" buttons (Accept on `high` risk requires a second
  click confirming "really do this")
- On Accept: POST to `/actions/execute`, show toast on success/failure

Used on the home-page briefing card (#5) and inline in voice-assistant
responses (#4).

---

## #5 — Daily AI Briefing (with action recommendations)

**Goal:** every morning, get a paragraph summarizing what happened in the
homelab overnight, plus 0–5 specific recommended actions ("you should ack
these alerts", "consider restarting Plex which has been flapping").

### Scope

**Backend (n8n workflow `Daily Briefing`):**
1. Schedule trigger at 6am local (use cron expression).
2. Gather inputs in parallel:
   - Last 24h of `pending_alerts` + acknowledgements
   - 24h `service_health_history` aggregations (uptime % per service)
   - 24h Wazuh top rules + critical insights
   - 24h dashboard auth concerning events
   - Yesterday's news count by topic (optional — depends on user value)
3. Build a prompt that includes that snapshot + the action catalog
   (`GET /actions/catalog`) so the LLM knows what it can recommend.
4. System prompt requires the LLM to return strict JSON:
   ```json
   {
     "summary": "Markdown text, 2–4 paragraphs",
     "actions": [ <ActionDescriptor>, ... ]
   }
   ```
   The system prompt MUST forbid autonomy: "Never recommend an action you
   cannot fully justify in `description`."
5. Persist the briefing to a new MySQL table:
   ```sql
   CREATE TABLE ai_briefings (
     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     date DATE NOT NULL UNIQUE,
     summary_md TEXT NOT NULL,
     actions JSON NOT NULL,
     dismissed_at TIMESTAMP NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
6. Track dismissed actions separately so they don't reappear immediately:
   ```sql
   CREATE TABLE ai_action_decisions (
     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     action_id VARCHAR(64) NOT NULL,
     args_hash CHAR(64) NOT NULL,
     decision ENUM('accepted','dismissed') NOT NULL,
     decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_action_args (action_id, args_hash, decided_at)
   );
   ```

**API endpoints (in same workflow or a partner one):**
- `GET /briefing/today` — returns today's briefing or 404
- `POST /briefing/dismiss` — marks today's briefing as dismissed (whole card)
- `POST /actions/decision` — `{action_id, args, decision}` — records that
  the user accepted or dismissed a specific recommendation. Used to suppress
  re-recommendations for some window (e.g. 7 days).

**Frontend:**
- New `BriefingCard` component shown at top of `HomePage` if there's an
  un-dismissed briefing for today.
- Renders `summary_md` (markdown → JSX, can use existing approach or add
  `react-markdown`).
- Below summary, renders each action via the shared `ProposedAction`
  component.
- A header X to dismiss the entire briefing card.

### Open questions

- **What time?** Default 6am local. Configurable later.
- **Where to display?** Home page top is the obvious place. Could also be a
  badge on the alert bell. Start with home page.
- **Markdown rendering:** add `react-markdown` (clean) or roll our own
  paragraph splitter (avoids dep). I'd add the dep — markdown content from
  LLMs gets richer over time.
- **Cost:** each briefing is ~5K input tokens + 1K output. With gpt-4o-mini
  that's ~$0.001/day. Cheap.
- **Dedup:** if the user dismisses an action, we shouldn't re-propose it
  next day if the underlying state hasn't changed. Hash `(action_id, args)`
  and check `ai_action_decisions` before including in tomorrow's briefing.

### Files to add / change

- `n8n-workflows/daily-briefing.json` — new workflow
- `src/components/BriefingCard.jsx` — new
- `src/components/ProposedAction.jsx` — new (shared with #4)
- `src/App.js` — add `<BriefingCard />` near top of `HomePage`
- `src/App.css` — styles for both components
- `package.json` — add `react-markdown` if going that route

### Estimate

~3-4h once the shared action-proposal layer is in place. ~2h additional if
building that layer from scratch as part of this work.

---

## #2 — Web Push Notifications

**Goal:** browser-native push notifications on phone/desktop even when the
dashboard tab isn't open. Pairs with the existing alert system.

### Scope

**Generate VAPID keys (one-time, manual):**
```bash
npx web-push generate-vapid-keys
```
- Public key → embedded in React build (env var `REACT_APP_VAPID_PUBLIC_KEY`)
- Private key → stored as n8n credential / env var

**Service worker (`public/sw.js`):**
- Handles `push` event → calls `self.registration.showNotification(title, opts)`
- Handles `notificationclick` event → focuses the dashboard tab and navigates
  to the alert's `url_hash`.
- Must be served at `/dashboard/sw.js` and registered with scope `/dashboard/`.
  CRA's default behavior is fine; might need a small webpack tweak.

**Frontend changes:**
- New hook `useWebPush()` in `src/hooks/useWebPush.js`:
  - Registers the service worker on mount
  - Requests notification permission (already requested by `useAlerts`, can
    share)
  - Calls `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })`
  - POSTs the resulting subscription to `/webpush/subscribe`
- Hook exposed in the AlertDrawer or settings: a toggle "Push notifications
  on this device".

**Backend (extend or new n8n workflow):**

`POST /webpush/subscribe` — body is the JSON subscription object. Stores in:
```sql
CREATE TABLE push_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh VARCHAR(200) NOT NULL,
  auth VARCHAR(100) NOT NULL,
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

`POST /webpush/unsubscribe` — `{ endpoint }` — DELETE row.

**Wire into Alert System workflow:**
After the existing `Insert Alerts` step (or in parallel), add a "Send Push"
node that:
1. Reads all `push_subscriptions`
2. For each subscription + each new alert: signs a VAPID JWT and POSTs to the
   endpoint with the encrypted payload.

**The hard bit: VAPID JWT + payload encryption inside n8n**

VAPID JWT is ES256 (ECDSA P-256, SHA-256). Payload is encrypted with ECDH
+ HKDF + AES-GCM. Doing this in pure n8n Code nodes via `crypto.subtle` is
possible but tedious. Two alternatives:

1. **Sidecar Node service.** Write a ~80-line Node service that exposes
   `POST /push/send {endpoint, p256dh, auth, payload}` and uses the
   `web-push` npm package. Run on the dashboard server (same host as the
   SSE broadcaster). n8n calls it. **Recommended** — much less code, leans
   on a battle-tested lib.
2. **Pure n8n Code node** using `crypto.subtle`. Doable but ~150 lines of
   crypto wrangling.

Going with option 1 unless there's a reason not to introduce another
sidecar service.

### Open questions

- **iOS support:** requires the dashboard to be installed as a PWA on iOS.
  Confirm `manifest.json` has `display: standalone` and a proper start_url.
  We already have a manifest.json (it's what triggered the false alert
  loop earlier).
- **Subscription cleanup:** push endpoints can return `410 Gone` when the
  user uninstalled or revoked permission. The sender should DELETE those
  subscriptions when it sees a 410.
- **Per-device opt-in:** each browser/device subscribes separately. The UI
  should make it clear which devices are subscribed and let the user revoke
  any of them.

### Files to add / change

- `n8n-workflows/web-push.json` — new workflow with subscribe/unsubscribe
  + send-push helper
- Modify `n8n-workflows/<alert-system-export>.json` — add Send Push step
- `public/sw.js` — new service worker
- `src/hooks/useWebPush.js` — new
- `src/components/AlertDrawer.jsx` — add "enable on this device" toggle
- `.env` — add `REACT_APP_VAPID_PUBLIC_KEY`
- New sidecar Node service (location TBD, probably alongside SSE
  broadcaster) — `web-push-sender.js`

### Estimate

~3-4h with the sidecar approach. ~6h for pure n8n.

---

## #4 — Voice Assistant: Tool-Calling (with proposal-only flow)

> **Status: cancelled (2026-04-26).** After thinking it through, the user
> decided they do not want the AI to be able to mutate any server state at
> all — even with explicit per-action consent. Without mutating actions the
> only thing this build would add is OpenAI function-calling for read-only
> lookups, which is a marginal improvement over the current "snapshot
> baked into the system prompt" approach. Not worth the engineering.
>
> **Standing principle for future work:** the AI is read-only. It can
> describe state, summarize trends, and suggest *manual* steps the user
> might take in plain English — but actions in the catalog should stay
> read-only. If a future session is tempted to add a mutating action,
> double-check with the user first.

**Goal (original, for reference):** the voice assistant can answer
questions that require *doing* something, not just describing state. But
— per the hard constraint — it must always propose an action and wait for
accept/deny, never execute on its own.

### Scope

**Architecture change in the voice workflow:**

Current flow: user → STT → LLM (text completion) → TTS → user.

New flow:
1. user speaks → Whisper STT
2. n8n calls OpenAI with **tool definitions** (the read-only ones from the
   action catalog). Mutating actions are NOT exposed as callable tools —
   instead they're listed as proposable actions in the system prompt.
3. LLM may make tool calls (read-only data lookups). n8n executes those,
   returns results.
4. LLM produces final response, which can include both:
   - Spoken text (TTS'd as before)
   - 0+ ProposedAction descriptors (returned as JSON in a structured part of
     the response)
5. Frontend speaks the text AND shows the proposed actions as cards next to
   the assistant's response.
6. User taps Accept on any card → `POST /actions/execute`.

**Why this split (read tools vs propose actions):**

Read-only tools are safe to chain — the LLM can call `list_alerts`, see
the IDs, then chain `get_service_history` on a flapping service to dig
deeper. No user friction needed.

Mutating actions need user consent. So instead of letting the LLM call
e.g. `ack_alerts` directly, we make `ack_alerts` a *proposable* action.
The LLM emits a proposal, the UI renders the card, the user taps Accept,
the dashboard calls the action. Same end result, with consent enforced by
architecture, not by trust.

**System prompt for the voice agent (sketch):**
```
You can answer with spoken text and also propose actions for the user to
review. You may NEVER execute mutating actions directly — only propose
them. When proposing, include enough context in `description` for the
user to evaluate without leaving the dashboard.

Available read-only tools (callable directly): <list>
Available proposable actions (return as proposals): <list>

If a question requires a mutating action, your spoken response must
explicitly say something like "I'd like to recommend the following — let
me know if you want me to proceed" so the user knows to look at the cards.
```

**Frontend changes:**

- The voice assistant bubble already exists in the nav. Extend its result
  display:
  - Text bubble (spoken response, also shown as text)
  - Below text: list of `ProposedAction` cards (reusing #5's component)
- Cards interact the same way as in the briefing.

### Open questions

- **Which mutating actions to enable in v1?** Recommend `ack_alerts` and
  `dismiss_recommendation` only. Anything that touches services
  (`restart_service`, `block_ip`) needs more design — possibly an Ansible
  bridge — and shouldn't ship in v1.
- **Voice confirmation flow:** if the user says "yes do it", does the
  assistant tap Accept on their behalf? Risky. Recommend: NO — Accept is
  always a deliberate UI gesture, never a voice command. Voice can only
  propose, not consent. (Exception: `ack_alerts` — basically harmless,
  could allow voice-confirm for that specific case.)
- **Function calling vs tool use:** OpenAI calls it "function calling" /
  "tools"; Anthropic calls it "tool use". The existing voice workflow uses
  OpenAI — stick with that for consistency.
- **Latency:** function calling adds a round trip. Could feel sluggish if
  the LLM does multiple lookups before answering. Tune the system prompt
  to discourage tool-calling chains > 2-3 deep.

### Files to add / change

- Modify the existing voice-assistant n8n workflow (Dashboard AI Agent or
  similar — find the one wired to `/dashboard/ask`)
- New action handlers in the action registry workflow (#5 cross-cutting)
- `src/components/VoiceAssistant.jsx` — extend response display to include
  `ProposedAction` cards
- Reuse `ProposedAction` component from #5

### Estimate

~3-4h once the action layer from #5 is in place.

---

## Recommended build order

1. **Cross-cutting action layer** (`/actions/catalog`, `/actions/execute`,
   `ProposedAction` component, `ai_action_decisions` table). ~2h.
2. **#5 Daily Briefing** — uses the action layer. ~3h.
3. **#2 Web Push** — independent of the action layer. ~3-4h.
4. **#4 Voice tool-calling** — uses the action layer + #5 component. ~3-4h.

**Total estimate:** ~12-14h spread across as many sessions as you want.

## Notes for the next session

- Read this file first.
- Read CLAUDE.md for project conventions.
- Read the workflow JSON files in `n8n-workflows/` for n8n patterns
  (especially `service-health.json` for schedule + MySQL pattern,
  `dashboard-auth.json` for the action layer's classification approach).
- The user wants Apple-quality UX: clean cards, no jank, explicit
  confirmation, and the AI's reasoning visible by default (not hidden behind
  a "details" link).
