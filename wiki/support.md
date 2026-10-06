# Telegram support

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

## Identity, privacy and routing

The Worker authenticates webhook deliveries with `TELEGRAM_WEBHOOK_SECRET`. Only private chats are eligible. Commands are handled before support; `/start` is never treated as a ticket and `/stats` remains restricted to `ADMIN_TELEGRAM_IDS`. This repository has no bot-chat `/start` response handler; the Mini App's first-run welcome flow is separate.

The support code is a short prefix of a keyed HMAC using `USER_ID_HMAC_SECRET`, stable for a student and not reversible to a Telegram ID. The Worker copies accepted messages with Telegram `copyMessage` in both directions, never `forwardMessage`.

D1 stores the HMAC user hash, AES-GCM encrypted student chat routing value, allowlisted admin chat ID used as a route key, Telegram message IDs, and timestamps. It never stores message text/caption, media/file IDs, username/name/avatar, or the raw student Telegram ID. `SUPPORT_ENCRYPTION_KEY` is a separate Worker secret; AES-GCM uses a fresh random IV. A decrypted student chat ID exists only in Worker memory while calling Telegram. Admin reply routing is scoped to both the allowlisted admin's private chat and that admin's copied message ID.

## Limits and retention

- Text, photo, document, voice, audio, video, animation and sticker messages are copied. Contacts, location/live location, Telegram Passport data, and unsupported types receive a safe text explanation.
- A student may send up to 10 support messages per 5 minutes. Further messages receive a temporary rate-limit notice.
- The short acknowledgement is sent only for the first message from that student in the preceding 5 minutes; a burst does not get one acknowledgement per text/photo. A failed initial delivery still consumes that acknowledgement window.
- Routing rows older than 30 days are removed by the existing daily Worker scheduled handler. This adds no Cron Trigger.
- Repeated delivery of the same Telegram message is deduplicated. There is a small unavoidable window if Telegram accepts a copy but D1 fails before its route is recorded.
- If no administrator copy succeeds, the student is told support could not be reached. A failed student delivery is reported to the administrator without exposing technical details.

## Production configuration

Use the existing Worker `iu5hub-analytics`, D1 `iu5hub-analytics`, Telegram webhook and free Cloudflare architecture. Existing `ADMIN_TELEGRAM_IDS` is the support-admin allowlist; no new admin configuration is required. Keep `SUPPORT_ENCRYPTION_KEY` set as a strong random Worker secret. Keep `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `USER_ID_HMAC_SECRET` and all other credentials out of Git, Wiki, logs and frontend bundles.

Production migration `0004_support.sql` and `SUPPORT_ENCRYPTION_KEY` are applied; Worker `iu5hub-analytics` was deployed on 2026-10-06. Unauthorized production webhook requests were rejected. Automated delivery tests use mocked Telegram API calls. A live student → admin → Reply → student check still requires a second Telegram account. For later releases, apply pending migrations, retain the Worker-only secret, and redeploy; see `deployment.md`, `security.md` and `testing.md`.
