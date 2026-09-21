# ADR-0003: Telegram-only Mini App on Cloud.ru with Yandex Disk materials

## Context

The initial MVP documentation described a public Web + Telegram application, Beget FreeHosting, a custom public domain and a platform adapter containing both Web and Telegram runtimes. That approach no longer matches the product: students must enter through the bot «Студент ИУ5», and the Mini App is the only user interface.

The project must remain a small static React/TypeScript/Vite frontend, while allowing frontend hosting to change without changing the public student link. Study files already belong in Yandex Disk and do not need to be duplicated in frontend hosting.

## Previous architecture

The superseded architecture exposed a public website and Telegram Mini App from one SPA, planned Beget hosting and a custom domain, and used `WebPlatformAdapter` versus `TelegramPlatformAdapter`. ADR-0001 and ADR-0002 preserve that history.

## Decision

- Студент ИУ5 is Telegram-first and Telegram-only. Its public entry point is `https://t.me/<bot_username>`; the bot opens the Mini App.
- The production frontend artifact is built with `npm run build`. The contents of `dist/` are deployed to Cloud.ru Evolution Object Storage with Static Website Hosting and an HTTPS endpoint.
- Cloud.ru is technical infrastructure only. Its endpoint is configured for the Mini App but must not be distributed in QR codes, chats, guides or social posts. No Cloud.ru URL is hardcoded unless deployment configuration truly requires it.
- Yandex Disk remains the canonical store for PDFs, DOCX, PPTX, ZIP, video and other study materials. The Mini App catalog opens validated external links through the Telegram integration layer.
- UI reads catalog data only through `MaterialsRepository`. The current static implementation remains valid; a future Yandex Disk sync, API, database or search index replaces the repository implementation rather than UI code.
- Remove the Web-only half of the old adapter. Retain a centralized Telegram integration layer for initialization, `ready()`, theme, viewport and safe areas, user context, BackButton, external links and platform differences. The Mini App supports Compact, Fullsize and Fullscreen by reacting to viewport/safe-area changes; it does not call `expand()` or request fullscreen automatically. UI components do not call `window.Telegram.WebApp` directly.
- Use `HashRouter` for the Mini App. This keeps client navigation reliable on replaceable static Object Storage without requiring a provider-specific SPA fallback.
- CI verifies install, lint, typecheck, tests and build. After verification, deployment to Cloud.ru is automated when the required GitHub Actions Secrets and Object Storage configuration are available.

## Consequences

The product no longer needs a public landing page, Web/Telegram mode selector, Taplink, Beget, or a user-facing custom domain. Local browser execution is a development and test aid, not a supported product mode.

Telegram client integration becomes a release-critical surface: iOS, Android, Desktop and Telegram Web must be checked for launch, theme, safe areas, navigation, BackButton and Yandex Disk links. Telegram user data remains UI-only until a future backend validates `initData` server-side.

Cloud.ru credentials, Telegram bot token and all other secrets remain outside Git and Vite client variables. A host migration changes the Mini App technical URL/configuration, not the student-facing bot link.

## Migration

1. Preserve prior ADRs and mark their superseded assumptions; update Wiki to the current architecture.
2. Replace Web-only UI/runtime code and Beget-specific configuration with the Telegram integration layer and Cloud.ru static-hosting configuration.
3. Keep and validate `MaterialsRepository`; replace demo catalog entries only after real Yandex Disk links are available.
4. Provision the Object Storage bucket, static website endpoint, HTTPS and GitHub Actions Secrets; configure the Mini App URL in the bot.
5. Run CI, deployment, Telegram-client smoke tests, adversarial checks and security review before release.

## Status

Accepted — 2026-09-11.
