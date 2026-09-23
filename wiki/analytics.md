# Private analytics

## Purpose

«Студент ИУ5» uses first-party, minimal analytics so administrators can understand catalogue usage. The source of truth for a unique user is a Telegram `initData` signature validated by the Cloudflare Worker, followed by a keyed HMAC pseudonym in D1. Cloudflare Web Analytics may still serve page performance/visit analysis, but is not authoritative for Telegram users.

Ordinary users have no statistics navigation. A server-authorized administrator can use `/stats` in the bot for a compact report or open the private `/#/admin/stats` dashboard.

## Data minimisation

The system stores only a keyed pseudonymous `user_hash`; first/last activity timestamps and launch aggregate; event type, timestamp, and applicable internal subject/material IDs.

«Студент ИУ5» **does not collect photos/avatars, names, usernames, phone numbers, bios, or other Telegram profile data for analytics.** It also does not store raw Telegram IDs, `initData`, search phrases, material titles, or Yandex Disk URLs. `ANALYTICS_HMAC_SECRET` is Worker-only, is never a `VITE_*` value, and must not appear in Git, logs, test fixtures, output or Wiki values.

## Events

| Event | Trigger | Stored dimensions |
| --- | --- | --- |
| `app_open` | a real Mini App open reaches `POST /api/analytics/open` | none |
| `search` | a user submits a search action | none; never query text |
| `subject_open` | an internal subject opens | `subject_id` |
| `material_open` | an internal material/file opens | `subject_id`, `material_id` where known |
| `yandex_disk_open` | an explicit Disk transition happens | `subject_id`, `material_id` where known |

`POST /api/analytics/event` has an allowlist, small body limit and strict ID validation. Identity comes only from validated `initData`, never a frontend user ID. Delivery is fire-and-forget: unavailable analytics never prevents study navigation. A short server-side per-user deduplication window reduces accidental reload inflation for `app_open`. Rate limiting is not configured yet; add a Cloudflare edge rule before relying on it to protect D1 from scripted event flooding.

## Retention

The approved retention policy is **90 days for raw `events`**. The Worker has an idempotent daily cleanup trigger which deletes only older events; include its execution in release verification. Pseudonymous `users` aggregate rows remain while the service operates for all-time unique users and launches. Reassess retention before collecting any additional dimension; a future erasure policy must delete the corresponding events with a user row.

## Metric definitions

All boundaries are UTC unless an explicitly labelled dashboard view says otherwise. Trailing periods end at query time.

| Metric | Definition |
| --- | --- |
| Total users | distinct `users.user_hash`, all time |
| DAU / Today | distinct event `user_hash` since current UTC midnight |
| WAU / 7 days | distinct event `user_hash` in trailing 7 × 24 hours |
| MAU / 30 days | distinct event `user_hash` in trailing 30 × 24 hours |
| Launches | recorded `app_open` events in the selected period |
| Searches/material opens/Disk opens | count of their respective events in the selected period |
| Popular subjects/materials | descending allowed event count grouped by internal ID; UI resolves current labels via the repository |

The 30-day activity view includes zero-event UTC days and distinguishes daily distinct active users from launch count. Empty D1 is a valid zero state.

## Administration and `/stats`

Every `/api/admin/*` request validates fresh Telegram `initData`, extracts its verified user ID, and checks server-only `ADMIN_TELEGRAM_IDS` before D1 access. Malformed, expired or non-admin requests get an authentication failure/`403` and no data. A hidden React link is not authorization.

`/telegram/webhook` accepts updates only if Telegram's secret-token header matches Worker-only `TELEGRAM_WEBHOOK_SECRET`. It handles only the `/stats` command in a private chat with the authorized sender, and replies using Worker-only `TELEGRAM_BOT_TOKEN` with an aggregate report plus dashboard deep link.

## Provisioning and troubleshooting

Deploy the Worker to its HTTPS Worker hostname (or explicitly attach routes for `/api/*` and `/telegram/webhook`); bind production D1 as `ANALYTICS_DB`; apply migrations to that exact database before routing traffic. When it uses a separate hostname, set Pages' non-secret `VITE_ANALYTICS_API_BASE` to that HTTPS origin and retain `ANALYTICS_ALLOWED_ORIGIN=https://iu5hub.pages.dev`. Required Worker secrets: `ANALYTICS_HMAC_SECRET`, `ADMIN_TELEGRAM_IDS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. `ADMIN_DASHBOARD_URL` is a non-secret Worker configuration value for the bot button. Secrets are not Pages settings, repository variables, frontend configuration or literal `wrangler` values. Configure Telegram webhook with the same secret and only needed update types.

| Symptom | Safe check |
| --- | --- |
| Admin dashboard is forbidden | use a fresh Telegram launch and verify the trusted ID is in the Worker allowlist; do not inspect a browser admin flag |
| `/stats` is silent | check route, secret-header setup and redacted Worker logs; do not expose the bot token |
| Metrics stay at zero | check Worker route, D1 binding/migrations, real Telegram initData and allowlisted event type |
| Events grow unexpectedly | verify 90-day scheduled cleanup and the dedup/rate-limit settings before changing definitions |
