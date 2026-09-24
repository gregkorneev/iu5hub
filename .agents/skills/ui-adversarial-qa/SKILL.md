---
name: ui-adversarial-qa
description: Run real-browser adversarial UI QA for «Студент ИУ5» after meaningful UI or Telegram Mini App changes, including route interaction, browser debugging, accessibility, and regressions.
---

Use this skill for UI work in «Студент ИУ5» that changes visible flows, routes, Telegram integration, catalog data rendering, forms, or responsive CSS. Do not use it for documentation-only changes.

1. Read `wiki/current-state.md`, `wiki/testing.md`, `wiki/telegram.md`, and the relevant source before changing code. Preserve strict Telegram and Yandex Disk URL validation; use test fixtures rather than production switches.
2. Run the affected UI in Playwright. The suite starts Vite itself and mocks `window.Telegram.WebApp` plus Yandex Disk API only in `tests/ui/fixtures.ts`.
3. Explore the reachable controls as a student: route forward/back, direct HashRouter URLs, empty/error paths, fast input and repeated actions. Check mobile portrait first, then desktop. Record console exceptions, failed HTTP responses, and layout overflow.
4. For every P0/P1 and safe P2 defect: reproduce it, add or update a deterministic browser regression test, fix the shared root cause, then rerun the relevant test. Keep traces and screenshots as untracked artifacts.
5. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:ui`. For a broad UI change also run `npm run test:ui -- --project=webkit` when its browser is installed.
6. Update `wiki/testing.md`, `wiki/current-state.md`, `wiki/known-issues.md`, and `wiki/changelog.md` with real limitations and the QA result. Commit only verified changes.
