# Private analytics

## Purpose

«Студент ИУ5» uses first-party, minimal analytics so administrators can understand catalogue usage. The source of truth for a unique user is a Telegram `initData` signature validated by the Cloudflare Worker, followed by a keyed HMAC pseudonym in D1. Cloudflare Web Analytics may still serve page performance/visit analysis, but is not authoritative for Telegram users.

Ordinary users have no statistics navigation. A server-authorized administrator can use `/stats` in the bot for a compact report or open the private `/#/admin/stats` dashboard.

## Data minimisation

The system stores only a keyed pseudonymous `user_hash`; first/last activity timestamps and launch aggregate; event type, timestamp, and applicable internal subject/material IDs.

Activity events remain pseudonymous and do not contain Telegram profile fields. A deliberate, narrow policy exception is being introduced for the **current Telegram username only**, stored separately from events for administrator-only operational statistics and understanding the active audience. The planned `analytics_user_labels` row uses the existing analytics `user_hash` and stores `username` (without `@`, nullable) plus `updated_at`; it contains no Telegram ID, name, surname, avatar/photo, phone or bio. The label is sourced only from cryptographically validated Telegram `initData` at the Worker and is returned only by the authenticated, allowlisted admin users endpoint. It is refreshed or cleared on a verified Mini App open and expires after 90 days without a verified launch. No historical backfill is possible or planned.

Analytics must never store raw Telegram IDs, `initData`, search phrases, material titles, Yandex Disk URLs, names, surnames, photos/avatars, phone numbers or bios. Usernames are prohibited in `events`, support storage, logs, public frontend configuration and analytics event payloads. `ANALYTICS_HMAC_SECRET` is Worker-only, is never a `VITE_*` value, and must not appear in Git, logs, test fixtures, output or Wiki values.

## Events

| Event | Trigger | Stored dimensions |
| --- | --- | --- |
| `app_open` | a real Mini App open reaches `POST /api/analytics/open` | none |
| `search` | a user submits a search action | none; never query text |
| `subject_open` | an internal subject opens | `subject_id` |
| `material_open` | an internal material/file opens | `subject_id`, `material_id` where known |
| `yandex_disk_open` | an explicit Disk transition happens | `subject_id`, `material_id` where known |

`POST /api/analytics/event` has an allowlist, small body limit and strict ID validation. Identity comes only from validated `initData`, never a frontend user ID. Delivery is fire-and-forget: unavailable analytics never prevents study navigation. A short server-side per-user deduplication window reduces accidental reload inflation for `app_open`. Rate limiting is not configured yet; add a Cloudflare edge rule before relying on it to protect D1 from scripted event flooding.

Schedule routes do not emit group selection or schedule access analytics. Group slugs and LKS source identifiers are not accepted as analytics dimensions.

## Retention

The approved retention policy is **90 days for raw `events`**. The existing daily Worker scheduled handler deletes older events and username labels whose `updated_at` is older than 90 days. A verified launch refreshes the timestamp even when the username is absent, and an absent username clears the current label. Pseudonymous `users` aggregate rows remain while the service operates for all-time unique users and launches. No additional Cron Trigger is introduced.

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

The `GET /api/admin/stats/users?period=…&limit=…&offset=…` endpoint shares this boundary. It returns only username, first/last seen timestamps and existing `users.launch_count`, ordered by recent activity; page size is bounded to 100. The period selector filters users by `last_seen_at` in the chosen period (including all-time when selected). It never returns a Telegram ID, `user_hash`, support route, favorites or schedule preference. Migration `0005` and the Worker are deployed; see `deployment.md` for Pages publication and smoke status.

`/telegram/webhook` accepts updates only if Telegram's secret-token header matches Worker-only `TELEGRAM_WEBHOOK_SECRET`. It handles only the `/stats` command in a private chat with the authorized sender, and replies using Worker-only `TELEGRAM_BOT_TOKEN` with an aggregate report plus dashboard deep link.

## Provisioning and troubleshooting

Deploy the Worker to its HTTPS Worker hostname (or explicitly attach routes for `/api/*` and `/telegram/webhook`); bind production D1 as `ANALYTICS_DB`; apply migrations to that exact database before routing traffic. When it uses a separate hostname, set Pages' non-secret `VITE_ANALYTICS_API_BASE` to that HTTPS origin and retain `ANALYTICS_ALLOWED_ORIGIN=https://iu5hub.pages.dev`. Required Worker secrets: `ANALYTICS_HMAC_SECRET`, `ADMIN_TELEGRAM_IDS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. `ADMIN_DASHBOARD_URL` is a non-secret Worker configuration value for the bot button. Secrets are not Pages settings, repository variables, frontend configuration or literal `wrangler` values. Configure Telegram webhook with the same secret and only needed update types.

| Symptom | Safe check |
| --- | --- |
| Admin dashboard is forbidden | use a fresh Telegram launch and verify the trusted ID is in the Worker allowlist; do not inspect a browser admin flag |
| `/stats` is silent | check route, secret-header setup and redacted Worker logs; do not expose the bot token |
| Metrics stay at zero | check Worker route, D1 binding/migrations, real Telegram initData and allowlisted event type |
| Events grow unexpectedly | verify 90-day scheduled cleanup and the dedup/rate-limit settings before changing definitions |

# Support routing also uses the existing `ANALYTICS_DB` D1 binding but stores no analytics event or message content. See `support.md` for its encrypted routing schema, access boundary and 30-day retention.
