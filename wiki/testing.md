# Testing

Schedule CI is network-independent: `npm run schedule:validate` checks the generated 70-group dataset; `scripts/schedule/*.node-test.mjs` covers discovery/filtering, stable slug, parser/recurrence/timezone/exceptions, no-op comparison and atomic rollback. Playwright `schedule.spec.ts` covers group onboarding/search, Today/Week/day switching, current/next lesson, group change/profile, navigation, preferences and 320/390/428 px. Networked `schedule:inspect`/`schedule:sync` are release/operator commands, never CI.

## Required release gate

До commit/push должны пройти `lint`, `typecheck`, `test`, `build` и `test:ui`.

`verify` — обязательный GitHub Actions gate для всех push и pull request. Static deploy jobs are not proof of readiness until their own enabled `main` run succeeds: `deploy-cloudru` uses `CLOUDRU_DEPLOY_ENABLED == 'true'`; `deploy-cloudflare-pages` uses `CLOUDFLARE_PAGES_DEPLOY_ENABLED == 'true'`.

Search metadata checks run in CI using the checked-in CSV inventory: `npm run search:validate` and `npm run search:build:check`. They must not call Yandex Disk. `npm run search:sync` is a manual network command and is deliberately excluded from CI.

The tagging queue is generated from the checked-in inventory and is deterministic/offline. `npm run search:tagging-queue:check` verifies the committed queue is current. `search:apply-tags` checks every machine-managed field against `search-tags.csv` and updates only manual metadata; fixture tests cover valid apply and rejected stale/tampered rows.

The Excel workbook is regenerated from CSV by `npm run search:workbook`; its human-facing «Разметка» sheet contains the 29 subject folders directly inside semesters, a single tags field, and a separate teacher field. The folder name is automatically included among its tags. `npm run search:workbook:apply` imports only those editable fields and synonym rows, then validates/builds the generated index and prints coverage. Workbook generation/import uses local files and is not a network CI step. The `.xlsx` working file is gitignored; CSV remains the reviewed source of truth.

## Minimum automated coverage

- repository: поиск по title/subject/category/keywords и пустой результат;
- Telegram integration: безопасная инициализация, theme/navigation/link abstraction и developer fallback без `window.Telegram`;
- routes: known material/subject и not-found/empty states.
- Cloudflare Pages config: required token/account/project values and a valid project name.
- Playwright critical UI suite: startup, courses/folders/files, direct HashRouter route, Russian/empty search, Telegram BackButton fixture, mobile overflow and serious/critical axe violations. Vite starts automatically through Playwright `webServer`; no tunnel or Telegram login is required.
- Header branding uses the single public asset `/logo-iu5.jpeg`; the browser suite verifies it loads on the home route.
- Основной текст использует системный стек шрифтов, а бренд — локальный ALS Sector. Browser checks загружают Regular и Bold и проверяют, что бренд использует ALS Sector, а корневой элемент — системный стек.
- Home search: on a mobile viewport a live suggestion must remain visually above the course catalog and tappable at its centre; the regression asserts it with `document.elementFromPoint`.
- Home search also accepts a Latin transliteration of a Russian query (for example, `ma` finds `Математический анализ`); the mobile regression covers this input before checking the suggestion's tappability.
- Home fills the Telegram viewport in ordinary portrait and does not scroll when content fits. On a short portrait viewport or while the search field has focus, vertical scrolling keeps content reachable above the mobile keyboard. Landscape also allows vertical scrolling when needed. Horizontal overflow remains blocked; catalog and search routes scroll normally.
- File cards use a fixed download-control column: the browser regression checks equal right alignment for short and long file names in both catalog and search results, in every viewport engine.
- Semester-folder names are recognized in both `sem` and `семестр` forms, regardless of case; mobile regression checks the two-column folder-tile layout and confirms even `Парадигмы и конструкции языков программирования` stays inside its tile and breaks only at spaces. A file in the same semester grid spans both columns, keeps its long name within bounds and retains its download button at the right edge.
- Header action: the server-confirmed admin Statistics link sits to the right of the brand, outside the persistent three-item bottom bar; it opens `/#/admin/stats` on desktop and mobile browser projects. Students do not receive the link.
- Disk search: a stalled Yandex Disk traversal is bounded to 10 seconds total and must turn into the existing visible search error rather than leaving `Ищем в папках и файлах…` indefinitely.
- Disk search follows a matching folder before returning, so a matching file in a deeper nested folder (including the `УТП` fixture) is returned alongside the folder without a fixed depth limit.
- Disk search combines matches from every connected course; unit and browser regressions verify both course results in one query.
- Tagged search suggestions and result links show each folder's parent path in secondary text; the browser regression verifies the two «Физика» folders remain distinguishable by semester.
- Analytics Worker: valid/invalid/expired Telegram `initData`, keyed user hashing, first/repeated open, event allowlist and ID validation, D1 total/DAU/WAU/MAU aggregates, and idempotent retention cleanup.
- Favorites Worker: missing/tampered Telegram auth is rejected; favorites are isolated by stable `USER_ID_HMAC_SECRET` identity; duplicate PUT, scoped GET/DELETE, malformed/oversized JSON, invalid course/path/type/name, CORS methods, and migration constraints are covered.
- Favorites browser flow: save a folder and file without triggering open/download, navigate to Profile, confirm grouped items, reload to confirm persistence, remove each item, and verify the three-item bar plus admin header action fit a 320 px viewport with accessible state. API requests are fixture-backed and do not touch production D1.
- Favorite layout: compare rendered title-line rectangles against heart button bounds for semester cards, long root/nested folder names, long filenames, and Profile rows at 320/390/768 px; assert no horizontal overflow and save screenshots of root, nested and Profile views.
- Authorization: admin allowlist success, direct non-admin admin API/route denial, `/stats` admin/non-admin handling, and webhook secret-header rejection.
- Worker regressions: event before `app_open` creates the pseudonymous user without inflating launches; `/stats` never replies in a group; 7/30-day metrics use trailing hours; only declared GET statistics routes and periods are accepted; oversized event bodies stop during streaming.
- Optional deploy configuration: both jobs require a public HTTPS `VITE_ANALYTICS_API_BASE` repository variable before building, while the general `verify` job remains independent of production configuration.
- Dashboard UI: empty/loading/error states, summary cards, period switching, zero-filled 30-day graph, popular subject/material long titles, and admin versus student mock users.
- Design resilience: 320 px semester tile geometry, light/dark Telegram palettes, route direction and `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` are covered by browser checks. The UI uses Telegram theme values through semantic CSS roles and keeps the `HashRouter`/BackButton/viewport layer intact.
- Mobile viewport scroll regression: Home, Profile and Schedule are checked at 390×844 and 320×568 with Telegram viewport/safe-area events. The document remains fixed; Home/Profile fit without main overflow at the standard size; Schedule Today and Week/day selection show two full lesson cards with more fixture lessons available through the named, keyboard-focusable list. Tests assert independent scrolling, no horizontal overflow, and a gap above the fixed navigation. Landscape (844×390 and 850×390) keeps the date controls visible and allows vertical scrolling only inside the lessons region; its available lesson viewport is intentionally compact. This is browser emulation; physical Telegram iOS/Android is not covered.

## UI adversarial QA

`npm run test:ui` runs Chromium, iPhone-like Chromium and local WebKit where installed. `npm run test:ui:headed` and `npm run test:ui:debug` are for diagnosis; `npm run qa` is the complete local gate. CI runs the Chromium project after build and keeps report/trace/video artifacts only for a failure.

The test fixture intercepts Yandex Disk API and injects a development-only `window.Telegram.WebApp` with user, theme/viewport/safe-area, `ready`, `openLink` and BackButton lifecycle. It never changes production code or relaxes the Yandex/HTTPS allowlists. Browser exploration must inspect console/page exceptions, unsuccessful responses, interaction outcome and horizontal overflow at 320px, mobile portrait, tablet and desktop.

After a meaningful UI change, run the critical suite and an adversarial smoke pass. For larger route/catalog/Telegram changes, repeat the complete browser matrix and document P3 limitations in `known-issues.md`.

2026-09-21: после исправления латинского ввода `Ma` прошли `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` и полный `npm run test:ui` (36 проверок: Chromium, mobile Chromium и WebKit); новых P3-ограничений не выявлено.

2026-09-23: после исправлений поиска, Worker и CI прошёл `npm run qa`: lint, typecheck, 17 Vitest тестов, 17 Node тестов, build и 54 Playwright проверки (Chromium, mobile Chromium, WebKit). `git diff --check` также прошёл. Реальный Telegram WebView и автоматический production deploy этим прогоном не проверялись.

2026-09-24: после редизайна `npm run test:ui` прошёл 63/63 в Chromium, mobile Chromium и WebKit. Browser QA проверил 320/390/428 px, светлую и тёмную Telegram themes, несовпадение темы ОС с Telegram, safe-area/viewport events, reduced motion/transparency, increased contrast, поиск и BackButton. На главной fixture не было page exceptions, console errors, failed GET или HTTP >=400; axe serious/critical и дополнительный color-contrast audit светлой/тёмной темы не нашли нарушений. Реальный Telegram WebView, фактическая экранная клавиатура и client-specific Compact/Fullsize/Fullscreen остаются ручной проверкой.

2026-09-24: после обновления корпоративной тёмной палитры повторно прошли `npm run lint`, `npm run typecheck` и `npm run test:ui` — 63/63 (Chromium, mobile Chromium, WebKit). Регрессия проверяет `themeChanged` dark→light, `data-telegram-theme`, тёмно-синий фон и возврат светлого, сохранение ввода поиска и safe-area. Отдельный axe color-contrast audit не нашёл нарушений в 16 сочетаниях 320/390 px × light/dark × home/course/semester/search; на 320 px переполнения папок нет. Реальный Telegram WebView этим прогоном не проверен.

2026-09-25: после настройки capsule geometry нижнего bar прошёл `npm run qa`: lint, typecheck, 22 Vitest, 45 Node tests, build и Playwright 90/90 в Chromium, mobile Chromium и WebKit. Регрессия проверяет pill radius, соотношение высоты/ширины < 0.25, 6 px горизонтальный inset, меньший moving bubble с равными верхним/нижним зазорами и 44 px touch targets. Скриншоты корневого и вложенного Catalog экранов визуально просмотрены: bar читается как капсула; реальные Telegram WebView и аппаратная клавиатура этим прогоном не проверены.

2026-09-24: финальный Liquid Glass release gate прошёл: `npm run lint`, `npm run typecheck`, `npm test` (17 Vitest + 38 Node tests), `npm run build`, полный Playwright 66/66 в Chromium, mobile Chromium и WebKit, `git diff --check`. Browser QA проверил 18 снимков light/dark × 320/390/428 px × home/catalog/search; шесть axe color-contrast аудитов не нашли нарушений. Sticky header при прокрутке держится на top=0 либо top=24 при Telegram inset=24; регрессия ловит просвечивание текста через верхнюю safe area. При `prefers-reduced-transparency` blur у шапки, поиска и подсказок отключён; при `prefers-contrast: more` у шапки нет blur и карточки получают контрастную границу. Новых P3 нет. Проверка в реальном Telegram WebView остаётся ручной.

2026-09-24: после пользовательской настройки прозрачности повторно прошли lint, typecheck, 17 Vitest, 38 Node tests, build и Playwright 66/66. Дополнительный mobile Chromium capture подтвердил уровни alpha light 58/70/84% и dark 66/76/88% и glass-поведение сфокусированного поиска; fallback режимы не менялись.

2026-09-24: после перевода основных действий, активных фильтров, периодов статистики и кнопок скачивания на glass-материалы прошёл полный `npm run qa`: lint, typecheck, 17 Vitest, 38 Node tests, build, Playwright 66/66. Регрессия подтверждает, что high-contrast и reduced-transparency отключают прозрачность и blur у primary action кнопок.

2026-09-24: mobile-native/UI polish прошёл lint, typecheck, 18 Vitest + 41 Node tests, build, `git diff --check` и Playwright 69/69 (Chromium, mobile Chromium, WebKit). Сквозной navigation audit 3/3 проверил переходы home→course→semester, прямой subject/material route, результаты поиска, hash reload и Telegram/in-app BackButton. На 320/390/428 px проверены обе темы, сфокусированный поиск при коротком viewport, длинный семестр и пустая папка; 24 снимка, без горизонтального overflow и page errors. Safe-area проверки 6/6; `theme-color` следует Telegram при несовпадении темы ОС и Telegram в трёх движках. Реальная экранная клавиатура, iOS zoom, status bar, tap latency/long-press и клиентские режимы Telegram требуют проверки на устройстве.

2026-09-25: финальный Liquid Glass polish прошёл полный `npm run qa`: lint, typecheck, 18 Vitest, 41 Node tests, build и Playwright 69/69 в Chromium, mobile Chromium и WebKit. Ручной browser audit проверил 320/390/428/1280 px, Telegram light/dark, safe area, 44×44 навигационные touch targets, reduced motion/transparency и increased contrast; navigation flow 3/3 без изменений. Сопоставимые before/after screenshots для существующей верхней навигации сохранены в текущем Codex task. Реальный Telegram WebView и экранная клавиатура требуют проверки на устройстве.

2026-09-25: tagged-search navigation regression reproduced and fixed. Direct read-only calls to the live public Yandex API returned 404 for the inventory display path including `1 course/`, and 200 with the expected folder for API-relative `/1 Семестр/Аналитическая геометрия`. Browser regression now asserts the decoded route path and that the folder contents (fixture file) render. After fix, run full release gate and Playwright across Chromium, mobile Chromium, and WebKit.

2026-09-25: search UI now asserts that suggestions and full results display only the original folder name, without teacher, tag, or path text.

2026-09-25: navigation glass group review passed at 320/390/428 px in Telegram light/dark fixtures. Playwright 63/63 (Chromium, mobile Chromium, WebKit); focused navigation checks 6/6. Existing hrefs remain `#/`, `#/search`, `#/admin/stats`; `aria-current` and one shared selection bubble track the current route. All three links retain ≥44×44 px hit areas; no horizontal overflow; bubble movement is suppressed by reduced motion; axe found no serious/critical admin-page issues. Actual Telegram iOS/Android WebView still requires device testing.

2026-09-25: persistent bottom navigation audit passed 15/15 in a temporary Playwright matrix across Chromium, mobile Chromium, and WebKit. Checked student/admin tab geometry at 320/390/428 px, light/dark theme, Telegram bottom inset 24 px, ≥44 px touch targets, Search result provenance and query restoration, Catalog-to-home behavior, Telegram BackButton, direct/reloaded deep hash routes, unknown/unauthorized routes, keyboard-like 500 px viewport, axe serious/critical issues, and footer reachability after scroll. Screenshots: `/tmp/iu5hub-bottom-nav-qa/320-light-student-chromium.png`, `/tmp/iu5hub-bottom-nav-qa/390-dark-search-keyboard-like.png`, and matching `320/390/428-{light,dark}-{student,admin}-{chromium,mobile-chromium,webkit}.png` files. The floating bar remains expanded on scroll; the footer is page content and scrolls fully clear of it. Actual Telegram WebView/onscreen keyboard still requires device testing.

2026-09-25: permanent bottom-navigation regression and screenshot tests added. After adding contextual Back and course-root controls to the same fixed glass touch bar, `npm run qa` passed lint, typecheck, 22 Vitest, 45 Node/Worker tests, build, and Playwright 87/87 across Chromium, mobile Chromium, and WebKit; `git diff --check` passed. Visual captures for Catalog root, nested Catalog with Back/root actions, Search results, keyboard-like viewport, admin Statistics, and footer-at-scroll-end are written to Playwright `test-results/bottom-navigation-*/`. Route scenarios prove contextual actions leave course logic and Telegram BackButton intact, Search→folder provenance remains Search, direct/reloaded nested Catalog routes select Catalog, Catalog always opens home, and Search restores its last query. This is browser/WebView emulation; no physical Telegram device was connected.

2026-09-25: bottom Search activation now focuses the search input on route entry and on repeat taps while already on Search. The focused navigation regression passed on Chromium, mobile Chromium, and WebKit; typecheck, lint, and `git diff --check` passed. Automated browser focus is verified; presenting the OS keyboard inside Telegram WebView still needs a real device check.

2026-09-25: personal profile/favorites `npm run qa` passed lint, typecheck, 22 Vitest, 45 Node/Worker tests, production build, and Playwright 87/87 across Chromium, mobile Chromium and WebKit. Worker checks cover signed-user isolation, tampered initData, stable separate HMAC, parameterized owner-scoped SQL, malformed/oversized inputs, CORS and idempotent add/remove. Browser checks cover folder/file favorites, no accidental open/download on heart click, reload persistence, delete, optimistic rollback, removed Yandex file recovery, admin layout at 320 px, and mobile catalog overflow. Local and production D1 migrations applied; production Worker/Pages deployed; unauthenticated production API returns 401 and CORS preflight permits PUT/DELETE. The real Telegram account/device synchronization check remains manual.

2026-09-25: relocated Statistics from the bottom navigation to an admin-only header action beside the brand. The tab bar now has three primary destinations for both roles; admin route remains protected. Playwright regressions check student denial, admin access/current state, three-tab count, hit target, and no overlap/overflow at 320 px. Actual Telegram WebView remains device-only validation.

2026-09-25: tagged search now shows a small parent-path caption in both live suggestions and full results. Playwright verifies the two «Физика» folders show different course/semester paths, as well as the shared title/path hierarchy for a regular result.

2026-09-25: favorite-heart layout audit fixed the mobile folder-card overlap by keeping controls in the icon row above folder titles. `npm run qa` passed lint, typecheck, 22 Vitest, 45 Node/Worker tests, build and Playwright 90/90 in Chromium, mobile Chromium and WebKit. Geometry checks compared each rendered title line to the heart button on 320/390/768 px screens for course root, nested folders/files and Profile; no horizontal overflow. Screenshots: `test-results/favorites-keeps-favorite-h-65cea-out-the-catalog-and-profile-chromium/`. Real Telegram WebView remains a device-only check.

2026-09-25: folder titles now sit left-aligned below the folder icon across viewport sizes; the favorite heart stays in its own upper-right control area. UI geometry assertions cover root and nested folder cards at 320/390/768 px, including WebKit rounding. `npm run qa` passed lint, typecheck, 24 Vitest, 46 Node/Worker tests, build and Playwright 93/93 in Chromium, mobile Chromium and WebKit.

2026-09-25: removed the «К корню курса» action from nested Catalog/Search-result screens and deleted its component styles. `npm run qa` passed lint, typecheck, 22 Vitest, 45 Node/Worker tests, build and Playwright 90/90 in Chromium, mobile Chromium and WebKit. Browser regressions verify the shortcut is absent, the remaining Back control stays centered and usable, and Back / Telegram BackButton return through existing history.

2026-09-25: connected Course 3 to the nested public path `/IU5/3 course` under the shared Yandex Disk root. `npm run qa` passed lint, typecheck, 24 Vitest, 46 Node/Worker tests, build and Playwright 93/93 across Chromium, mobile Chromium and WebKit. Checks cover relative and already-prefixed paths, inventory sync root selection, root→semester→subject browsing, searchDisk traversal and file download URL path construction. The live public API returned both `5 sem` and `6 sem` from the configured root.

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

For curated folder search, verify one-character suggestions, case-insensitive tag and teacher prefixes, no result for blank/unmatched input, and direct navigation when selecting a suggestion. Text search should not make Yandex API requests; Yandex is used after navigation to load the folder contents.

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
