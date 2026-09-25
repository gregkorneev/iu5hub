# Security

## Analytics trust boundary

The Worker validates Telegram `initData` server-side, rejects missing/malformed/tampered/expired input, and only then reads `user.id`. Client `initDataUnsafe`, client-supplied Telegram IDs, and React route visibility never authorize access or determine stored identity.

The Worker stores only `HMAC-SHA-256(verified user.id, ANALYTICS_HMAC_SECRET)`. Raw IDs, initData, names, usernames, avatar/photo, phone, bio, search text, Disk URLs and material titles are prohibited from analytics storage and logs. Every `/api/admin/*` request repeats validation and checks `ADMIN_TELEGRAM_IDS`; webhook requests also require Telegram's configured secret-token header.

## Secret and binding policy

| Value | Allowed location | Prohibited locations |
| --- | --- | --- |
| Analytics HMAC, user ID HMAC, bot and webhook secrets | Cloudflare Worker secrets | Git, Wiki values, logs, test fixtures, `VITE_*`, Pages bundle |
| Admin allowlist | restricted Worker secret/config binding | React authorization, public runtime config |
| D1 binding | Worker configuration | frontend code/public API |

Use least-privilege deploy credentials, parameterized D1 statements, body/ID/event validation, and configure an edge rate limit for analytics writes. The rate limit is not currently configured; see `known-issues.md`. Errors and observability must redact secrets and full initData.

## Profile trust boundary

`GET`, `PUT` and `DELETE /api/profile/favorites` require fresh, valid Telegram `initData`. The Worker derives the owner with `USER_ID_HMAC_SECRET`; the client never chooses the owner. Queries and deletion include `user_hash`, and a composite primary key prevents duplicate favorites. Input is length-bounded and checked before parameterized D1 statements. The private profile stores only course, path, type, name and creation time; Telegram name and username are UI-only, and photos/avatars are never collected. See `profile.md` and ADR-0004. Keep `USER_ID_HMAC_SECRET` stable, or migrate hashes deliberately before rotating it.

## Required review checks

- Tampered/expired initData cannot write events or read stats.
- A direct admin API/route request by a non-admin returns no dashboard data.
- A webhook request without the exact secret header is rejected before bot handling.
- Repeated calls cannot produce unbounded `app_open` rows.
- D1 migrations, compiled bundles and logs contain no raw ID, profile/search data or secrets.
- Two distinct verified Telegram users cannot read or delete each other's favorites; missing, tampered or expired initData receives `401`.
