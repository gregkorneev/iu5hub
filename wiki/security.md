# Security

## Analytics trust boundary

The Worker validates Telegram `initData` server-side, rejects missing/malformed/tampered/expired input, and only then reads `user.id`. Client `initDataUnsafe`, client-supplied Telegram IDs, and React route visibility never authorize access or determine stored identity.

The Worker derives analytics identity only as `HMAC-SHA-256(verified user.id, ANALYTICS_HMAC_SECRET)`. A narrow, admin-only analytics exception is deployed: migration `0005_analytics_user_labels.sql` stores the current Telegram `username` separately from events, keyed by the existing pseudonymous `user_hash`. The username comes only from server-verified `initData`, is refreshed/cleared on verified launch, and is exposed only through authenticated `/api/admin/stats/users` after the existing `ADMIN_TELEGRAM_IDS` check. Activity event rows and frontend event payloads never contain a username.

Analytics must not store raw Telegram IDs, names/first/last names, avatar/photo, phone, bio, `initData`, search text, Disk URLs or material titles. The username label must not enter logs, public frontend configuration, events or support DB. `analytics_user_labels` is retained only while a verified launch refreshes it within 90 days; the existing scheduled handler performs cleanup. Users without a current username have a null label. Historical users are not backfilled. This exception is for operational statistics and understanding the active audience; it does not join analytics to profile or support data.

Every `/api/admin/*` request repeats validation and checks `ADMIN_TELEGRAM_IDS`; webhook requests also require Telegram's configured secret-token header.

## Secret and binding policy

Production and Beta are separate trust boundaries. Each Worker environment needs its own secret bindings; generate independent Beta HMAC, webhook and support encryption secrets rather than copying production values. `ADMIN_TELEGRAM_IDS` may use the same administrator IDs but must be configured separately as a Beta Worker secret. Never retrieve production secret values to populate Beta. Beta's `ANALYTICS_DB` binding must refer to Beta D1, and Beta CORS must allow only the actual Beta Pages origin. Production CORS, bindings and Telegram webhook remain unchanged by beta pushes.

Beta resources are provisioned: its D1 ID differs from production and migrations `0001`–`0006` are applied to the fresh database. The independent Beta HMAC, webhook and support encryption secrets are present. The Beta admin allowlist and bot token remain unset until supplied through the administrator/BotFather setup. Smoke confirmed a Beta-origin preflight receives `Access-Control-Allow-Origin: https://beta.iu5hub.pages.dev`; the production Worker does not grant that origin and continues to allow only `https://iu5hub.pages.dev`.

| Value | Allowed location | Prohibited locations |
| --- | --- | --- |
| Analytics HMAC, user ID HMAC, bot and webhook secrets | Cloudflare Worker secrets | Git, Wiki values, logs, test fixtures, `VITE_*`, Pages bundle |
| Admin allowlist | restricted Worker secret/config binding | React authorization, public runtime config |
| D1 binding | Worker configuration | frontend code/public API |

Use least-privilege deploy credentials, parameterized D1 statements, body/ID/event validation, and configure an edge rate limit for analytics writes. The rate limit is not currently configured; see `known-issues.md`. Errors and observability must redact secrets and full initData.

## Profile trust boundary

`GET`, `PUT` and `DELETE /api/profile/favorites` require fresh, valid Telegram `initData`. The Worker derives the owner with `USER_ID_HMAC_SECRET`; the client never chooses the owner. Queries and deletion include `user_hash`, and a composite primary key prevents duplicate favorites. Input is length-bounded and checked before parameterized D1 statements. The private profile stores only course, path, type, name and creation time; Telegram name and username are UI-only, and photos/avatars are never collected. See `profile.md` and ADR-0004. Keep `USER_ID_HMAC_SECRET` stable, or migrate hashes deliberately before rotating it.

Schedule preference uses the same validated identity and a separate `profile_preferences` row containing only the `iu5-*` slug and timestamp. Lesson JSON is public static Pages data. Schedule never logs a group identifier to analytics and never requests LKS from the user's browser. See `schedule.md`.

## Required review checks

- Tampered/expired initData cannot write events or read stats.
- A direct admin API/route request by a non-admin returns no dashboard data.
- A webhook request without the exact secret header is rejected before bot handling.
- Repeated calls cannot produce unbounded `app_open` rows.
- D1 migrations, compiled bundles and logs contain no raw ID, profile/search data or secrets.
- Two distinct verified Telegram users cannot read or delete each other's favorites; missing, tampered or expired initData receives `401`.

## Telegram support boundary

Support trusts only a Telegram webhook carrying the exact configured `TELEGRAM_WEBHOOK_SECRET`. Relay is limited to private chats. Commands run before support routing; `/stats` still requires an allowlisted administrator. For replies, the sender must be an allowlisted administrator in that private chat and the replied-to Telegram message ID must map to that same admin chat. Copies use Bot API `copyMessage`, never `forwardMessage`, so the bot is the student-facing sender.

Support D1 rows contain `user_hash`, an AES-GCM encrypted student chat routing value, the allowlisted `admin_chat_id` route key, Telegram message IDs and timestamps. They do not contain message bodies/captions/media, file IDs, usernames, names, avatars or the raw student Telegram ID. The user hash derives from `USER_ID_HMAC_SECRET`; a separate strong Worker secret `SUPPORT_ENCRYPTION_KEY` encrypts student routing IDs with Web Crypto AES-GCM and a fresh random IV. Decryption is transient in Worker memory only for a Telegram API call. Never add these secrets to Git, Wiki values, logs, fixtures or frontend configuration. Routing retention is 30 days and is cleaned by the existing scheduled handler. See `support.md`.
