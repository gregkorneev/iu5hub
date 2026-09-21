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

## UI adversarial QA

`npm run test:ui` runs Chromium, iPhone-like Chromium and local WebKit where installed. `npm run test:ui:headed` and `npm run test:ui:debug` are for diagnosis; `npm run qa` is the complete local gate. CI runs the Chromium project after build and keeps report/trace/video artifacts only for a failure.

The test fixture intercepts Yandex Disk API and injects a development-only `window.Telegram.WebApp` with user, theme/viewport/safe-area, `ready`, `openLink` and BackButton lifecycle. It never changes production code or relaxes the Yandex/HTTPS allowlists. Browser exploration must inspect console/page exceptions, unsuccessful responses, interaction outcome and horizontal overflow at 320px, mobile portrait, tablet and desktop.

After a meaningful UI change, run the critical suite and an adversarial smoke pass. For larger route/catalog/Telegram changes, repeat the complete browser matrix and document P3 limitations in `known-issues.md`.

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
