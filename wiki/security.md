# Security

## Analytics trust boundary

The Worker validates Telegram `initData` server-side, rejects missing/malformed/tampered/expired input, and only then reads `user.id`. Client `initDataUnsafe`, client-supplied Telegram IDs, and React route visibility never authorize access or determine stored identity.

The Worker stores only `HMAC-SHA-256(verified user.id, ANALYTICS_HMAC_SECRET)`. Raw IDs, initData, names, usernames, avatar/photo, phone, bio, search text, Disk URLs and material titles are prohibited from analytics storage and logs. Every `/api/admin/*` request repeats validation and checks `ADMIN_TELEGRAM_IDS`; webhook requests also require Telegram's configured secret-token header.

## Secret and binding policy

| Value | Allowed location | Prohibited locations |
| --- | --- | --- |
| HMAC, bot and webhook secrets | Cloudflare Worker secrets | Git, Wiki values, logs, test fixtures, `VITE_*`, Pages bundle |
| Admin allowlist | restricted Worker secret/config binding | React authorization, public runtime config |
| D1 binding | Worker configuration | frontend code/public API |

Use least-privilege deploy credentials, parameterized D1 statements, body/ID/event validation, and identity-aware rate limits. Errors and observability must redact secrets and full initData.

## Required review checks

- Tampered/expired initData cannot write events or read stats.
- A direct admin API/route request by a non-admin returns no dashboard data.
- A webhook request without the exact secret header is rejected before bot handling.
- Repeated calls cannot produce unbounded `app_open` rows.
- D1 migrations, compiled bundles and logs contain no raw ID, profile/search data or secrets.
