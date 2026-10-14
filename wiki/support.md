# Telegram support

## Production and Beta separation

Production continues to use bot «Студент ИУ5», its production webhook, Worker and D1. Beta support uses a separately created «Студент ИУ5 Beta» bot, Beta Worker webhook and Beta D1. Never point Beta at the production bot or webhook, and never copy support routes or users from production. The Beta bot token, when supplied, and its webhook secret are Worker-only secrets. BotFather creation/menu-button setup is an external manual step; record completion and the actual Beta Pages URL here after provisioning.

The Beta Worker and D1 are provisioned and use a separate webhook secret and support encryption key. The webhook returned `401` for missing and deliberately incorrect secret headers. BotFather creation, Beta token, menu button and the full student/admin reply relay remain pending; the production bot and webhook were not changed.

Student support uses the existing Telegram bot, webhook Worker and `ANALYTICS_DB` D1 database. No Mini App support screen or separate service is involved.

```text
student private message → Telegram bot → Worker → each allowed admin's private chat
admin Reply → Worker route lookup → Telegram bot → student's private chat
```

## How to answer a student

1. An incoming support message appears in the bot's private chat with a short stable code such as `#A82F`.
2. Use Telegram's **Reply** action on that message.
3. Write the response. The bot copies it to the student, who sees the bot as sender and no operator identity or signature.

An ordinary administrator message without Reply is never sent to a student. The bot gives the administrator a short hint to reply to an incoming request.

The admin-facing header appends the student's `message.from.username` from the current webhook when it is valid, for example `💬 Обращение #A82F · @username`. This value is used transiently for that admin message only. The stable pseudonymous support code remains the identifier; if username is absent or invalid, the header contains only the code.

## Identity, privacy and routing

The Worker authenticates webhook deliveries with `TELEGRAM_WEBHOOK_SECRET`. Only private chats are eligible. Commands are handled before support; `/start` is never treated as a ticket and `/stats` remains restricted to `ADMIN_TELEGRAM_IDS`. This repository has no bot-chat `/start` response handler; the Mini App's first-run welcome flow is separate.

The support code is a short prefix of a keyed HMAC using `USER_ID_HMAC_SECRET`, stable for a student and not reversible to a Telegram ID. The Worker copies accepted messages with Telegram `copyMessage` in both directions, never `forwardMessage`.

D1 stores the HMAC user hash, AES-GCM encrypted student chat routing value, allowlisted admin chat ID used as a route key, Telegram message IDs, and timestamps. It never stores message text/caption, media/file IDs, username/name/avatar, or the raw student Telegram ID. `SUPPORT_ENCRYPTION_KEY` is a separate Worker secret; AES-GCM uses a fresh random IV. A decrypted student chat ID exists only in Worker memory while calling Telegram. Admin reply routing is scoped to both the allowlisted admin's private chat and that admin's copied message ID.

If the sender has a valid non-empty `message.from.username`, the Worker includes it in the admin-facing header for the current webhook. It trims whitespace and accepts only 5–32 ASCII letters, digits or underscores; it performs no profile lookup and does not add a parse mode. Username is neither bound to SQL nor stored in support/analytics D1, logs or other persistent storage; it is not included in student-facing replies. First/last names and raw student IDs are not used as fallback.

This transient webhook display is independent of the planned analytics username label: the analytics label is sourced from verified Mini App `initData`, stored separately in `analytics_user_labels`, and returned only to the authenticated admin statistics UI. Support tables and routing are never queried to build the analytics users list.

## Limits and retention

- Text, photo, document, voice, audio, video, animation and sticker messages are copied. Contacts, location/live location, Telegram Passport data, and unsupported types receive a safe text explanation.
- A student may send up to 10 support messages per 5 minutes. Further messages receive a temporary rate-limit notice.
- The short acknowledgement is sent only for the first message from that student in the preceding 5 minutes; a burst does not get one acknowledgement per text/photo. A failed initial delivery still consumes that acknowledgement window.
- Routing rows older than 30 days are removed by the existing daily Worker scheduled handler. This adds no Cron Trigger.
- Repeated delivery of the same Telegram message is deduplicated. There is a small unavoidable window if Telegram accepts a copy but D1 fails before its route is recorded.
- If no administrator copy succeeds, the student is told support could not be reached. A failed student delivery is reported to the administrator without exposing technical details.

## Production configuration

Use the existing Worker `iu5hub-analytics`, D1 `iu5hub-analytics`, Telegram webhook and free Cloudflare architecture. Existing `ADMIN_TELEGRAM_IDS` is the support-admin allowlist; no new admin configuration is required. Keep `SUPPORT_ENCRYPTION_KEY` set as a strong random Worker secret. Keep `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `USER_ID_HMAC_SECRET` and all other credentials out of Git, Wiki, logs and frontend bundles.

Production migration `0004_support.sql` and `SUPPORT_ENCRYPTION_KEY` are applied; Worker `iu5hub-analytics` was deployed with the transient-username header update on 2026-10-06. No new migration was needed. Production webhook requests with missing/wrong secrets were rejected. Automated delivery tests use mocked Telegram API calls. The username-present header was not verified against a live incoming student message. For later releases, apply pending migrations, retain the Worker-only secret, and redeploy; see `deployment.md`, `security.md` and `testing.md`.
