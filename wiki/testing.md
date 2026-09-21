# Testing

## Required release gate

До commit/push должны пройти `lint`, `typecheck`, `test`, `build` и `test:ui`.

`verify` — обязательный GitHub Actions gate для всех push и pull request. Static deploy jobs are not proof of readiness until their own enabled `main` run succeeds: `deploy-cloudru` uses `CLOUDRU_DEPLOY_ENABLED == 'true'`; `deploy-cloudflare-pages` uses `CLOUDFLARE_PAGES_DEPLOY_ENABLED == 'true'`.

## Minimum automated coverage

- repository: поиск по title/subject/category/keywords и пустой результат;
- Telegram integration: безопасная инициализация, theme/navigation/link abstraction и developer fallback без `window.Telegram`;
- routes: known material/subject и not-found/empty states.
- Cloudflare Pages config: required token/account/project values and a valid project name.
- Playwright critical UI suite: startup, courses/folders/files, direct HashRouter route, Russian/empty search, Telegram BackButton fixture, mobile overflow and serious/critical axe violations. Vite starts automatically through Playwright `webServer`; no tunnel or Telegram login is required.
- Home search: on a mobile viewport a live suggestion must remain visually above the course catalog and tappable at its centre; the regression asserts it with `document.elementFromPoint`.
- Home search also accepts a Latin transliteration of a Russian query (for example, `ma` finds `Математический анализ`); the mobile regression covers this input before checking the suggestion's tappability.
- Home is locked to the Telegram viewport: mobile regression verifies both axes cannot scroll; catalog and search routes remain normally scrollable.
- File cards use a fixed download-control column: the browser regression checks equal right alignment for short and long file names in both catalog and search results, in every viewport engine.
- Header navigation: the home route hides only its redundant Catalog and Search links; inner routes preserve them. The server-confirmed admin Statistics link is above the hero layer and its click opens `/#/admin/stats` on desktop, mobile Chromium and WebKit.
- Disk search: a stalled Yandex Disk traversal is bounded to 10 seconds total and must turn into the existing visible search error rather than leaving `Ищем в папках и файлах…` indefinitely.
- Disk search follows a matching folder before returning, so a matching file in a deeper nested folder (including the `УТП` fixture) is returned alongside the folder without a fixed depth limit.
- Analytics Worker: valid/invalid/expired Telegram `initData`, keyed user hashing, first/repeated open, event allowlist and ID validation, D1 total/DAU/WAU/MAU aggregates, and idempotent retention cleanup.
- Authorization: admin allowlist success, direct non-admin admin API/route denial, `/stats` admin/non-admin handling, and webhook secret-header rejection.
- Dashboard UI: empty/loading/error states, summary cards, period switching, zero-filled 30-day graph, popular subject/material long titles, and admin versus student mock users.

## UI adversarial QA

`npm run test:ui` runs Chromium, iPhone-like Chromium and local WebKit where installed. `npm run test:ui:headed` and `npm run test:ui:debug` are for diagnosis; `npm run qa` is the complete local gate. CI runs the Chromium project after build and keeps report/trace/video artifacts only for a failure.

The test fixture intercepts Yandex Disk API and injects a development-only `window.Telegram.WebApp` with user, theme/viewport/safe-area, `ready`, `openLink` and BackButton lifecycle. It never changes production code or relaxes the Yandex/HTTPS allowlists. Browser exploration must inspect console/page exceptions, unsuccessful responses, interaction outcome and horizontal overflow at 320px, mobile portrait, tablet and desktop.

After a meaningful UI change, run the critical suite and an adversarial smoke pass. For larger route/catalog/Telegram changes, repeat the complete browser matrix and document P3 limitations in `known-issues.md`.

2026-09-21: после исправления латинского ввода `Ma` прошли `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` и полный `npm run test:ui` (36 проверок: Chromium, mobile Chromium и WebKit); новых P3-ограничений не выявлено.

## Analytics adversarial checks

Before release, exercise forged `initData`/Telegram ID, direct `/#/admin/stats` navigation as a student, invalid webhook secret, empty D1, one-user and high-cardinality results, repeated taps/reloads, unavailable D1/Worker, slow network and long repository labels. Verify a material or Disk link still opens when event delivery fails. Never place production tokens, real admin IDs or real initData into fixtures, snapshots or test output.

## Manual smoke matrix

| Scenario | Local developer browser | Telegram iOS/Android/Desktop/Web |
| --- | --- | --- |
| Home → semester → subject → material | useful | required |
| Search, empty and long query; подсказки при вводе | useful | required |
| Internal route / reopen | useful | required where supported |
| External Yandex Disk link | useful | required |
| Theme, Compact/Fullsize/Fullscreen viewport, safe areas, BackButton | n/a | required |
| Keyboard/focus and touch targets | useful | required |

Записывайте невыполнимые проверки и причину в `known-issues.md`.

## Local Telegram development check

`npm run dev:telegram` — optional development aid, not a release gate. Он запускает loopback Vite и временный Cloudflare Quick Tunnel с HTTP/2. Для текущей сессии допускается вручную направить designated dev-test bot `@iu5_archive_bot` на напечатанный temporary URL, если есть доступ к его настройке; не фиксировать URL/token в Git и не считать это подтверждённым WebView test без фактической проверки.

После изменения UI HMR в Telegram WebView может не обновиться из-за transport/WebSocket behavior. В этом случае reload/reopen Mini App — допустимая проверка. Остановить tunnel после теста; новая сессия всегда требует нового URL. Полная инструкция: `local-telegram-development.md`.

## Production smoke after deploy

- GitHub Actions: `verify` и выбранный static deploy job completed successfully; в log подтверждён target без раскрытия secrets.
- Cloud.ru: HTTPS endpoint возвращает актуальные `index.html`, `error.html`, hashed JS/CSS assets и `logo-iu5.jpeg`; `index.html` имеет `no-cache, no-store, must-revalidate`, assets — `public, max-age=31536000, immutable`, root files — `no-cache`.
- Routing: открыть base endpoint, deep HashRouter URL вида `/#/material/<id>` и каталог курса вида `/#/course/<course-id>?path=<folder-path>`; Static Website Hosting должен отдавать `index.html` для base endpoint. Из вложенной папки проверить Telegram BackButton и browser back: они возвращают на предыдущую внутреннюю страницу, а при отсутствии истории — на главную.
- Telegram: технический HTTPS endpoint задан как Mini App URL и проверен в iOS, Android, Desktop и Web; в каждом клиенте проверены Compact, Fullsize и, если клиент предоставляет его, Fullscreen. После `viewportChanged`/safe-area change контент остаётся видимым, без горизонтального скролла и без сброса маршрута или введённого поиска; приложение не должно автоматически расширяться.
- Rollback: перед release известен last-known-good commit/artifact; bucket versioning включён или прошлый artifact хранится отдельно от deploy target.
