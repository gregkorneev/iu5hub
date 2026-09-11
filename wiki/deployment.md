# Deployment

## Current target

Production frontend is a static React + TypeScript + Vite build on **Cloud.ru Evolution Object Storage** with Static Website Hosting and an HTTPS endpoint. Cloud.ru serves only `index.html`, compiled JS/CSS assets, icons, small images and static catalog data. PDFs, presentations, archives, video and other large files stay on Yandex Disk and open through external links.

The product entry point is Student Hub Bot (`https://t.me/<bot_username>`), which opens the Telegram Mini App. The Cloud.ru endpoint is a technical Mini App URL only: never distribute it in student chats, QR codes, presentations, handbooks, social posts or public documentation.

## Required Cloud.ru configuration

1. Create a dedicated Object Storage bucket for the production frontend.
2. Enable Static Website Hosting and configure `index.html` as the index document.
3. Configure an HTTPS endpoint suitable for Telegram Mini Apps.
4. The Mini App uses `HashRouter`; no provider-specific SPA fallback is required for client routes. Keep `index.html` as the index document.
5. Set cache policy deliberately: long-lived immutable caching for fingerprinted Vite assets; short/no-cache policy for `index.html` and mutable JSON catalog data.
6. Store Object Storage credentials only as GitHub Actions Secrets. Never commit access keys, secret keys, bot tokens, passwords or private keys.

## CI and deploy flow

```text
GitHub
  ↓
GitHub Actions: install → lint → typecheck → test → build
  ↓
Cloud.ru Evolution Object Storage: upload contents of dist/
  ↓
HTTPS technical endpoint
  ↓
Student Hub Bot → Telegram Mini App
```

The existing CI verification workflow must remain a required gate. Add deploy only after Cloud.ru bucket configuration and GitHub Secrets are available; deploy runs after a successful verification job. The workflow must upload the **contents** of `dist/`, not `dist/` as a nested directory, and must not publish source files, `.git/`, `node_modules/`, tests or `.env*` files.

## Release procedure

1. Start from the intended Git commit and run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Let CI deploy the validated `dist/` contents to the configured Cloud.ru bucket, or use the same authenticated deployment tooling while CI automation is being provisioned.
3. Verify HTTPS, `/`, direct/reopened internal route behavior according to the approved routing strategy, search, a Yandex Disk external link and asset caching.
4. Configure the HTTPS technical endpoint as the Mini App URL in the Telegram bot/BotFather tooling. Do not add the bot token to frontend configuration.
5. Smoke-test launch and navigation in Telegram iOS, Android, Desktop and Web: theme, viewport/safe areas, BackButton, search, empty/error states and Yandex Disk opening.
6. Record the released commit in Wiki, commit the documentation and push.

## Rollback

Never patch production outside Git. Select the last known-good commit, run the same release checks, deploy its `dist/` contents to the same bucket, and repeat the Telegram smoke test. Record the rollback in Wiki and push it. If hosting must change, update only the bot's technical Mini App URL after testing; the student-facing bot link remains stable.

## Secrets and environment policy

Vite `VITE_*` values are included in the client bundle and therefore cannot contain secrets. The frontend does not require a bot token and must never receive one. Keep real values in GitHub Actions Secrets or local ignored `.env` files; retain only non-sensitive placeholders in `.env.example`.

## Limitations

Cloud.ru Object Storage is frontend hosting, not a backend. Authentication, server-side Telegram `initData` validation, Yandex Disk API access, notifications, databases and admin functions remain future services and are not part of the MVP.
