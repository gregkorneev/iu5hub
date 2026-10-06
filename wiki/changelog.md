# Changelog

## 2026-10-06 — Telegram support

- Add a first-run Welcome step explaining how to message the bot in chat for material requests or help and receive a reply there. Full `npm run qa` passed (262 Playwright cases; two host-specific WebKit keyboard skips); the mobile regression verifies all four steps, accessible contrast and safe-area fit.
- Release Student IU5 v1.0.0 from the QA-verified `main` snapshot. Release notes: `wiki/releases/student-iu5-v1.md`.
- Final UX release regression: Linux CI exposed a compact 295×667 Home overflow with Favorites; compact useful-link spacing now keeps the support hint visible. Also fixed keyboard focus loss after Profile favorites Retry. Full local `npm run qa` passed (262 Playwright passed, two host-specific WebKit keyboard skips); [GitHub Actions 37459651166](https://github.com/gregkorneev/iu5hub/actions/runs/37459651166) passed all 330 Chromium, mobile Chromium, Firefox, WebKit and WebKit desktop cases. Production in-app Chromium smoke found no horizontal overflow at 295×667 and 16 widths from 320–1920px; Russian Search «физика» returned expected suggestions. Physical iOS/Android/iPad/Windows and Telegram WebView checks remain open; see `testing.md`.
- Add anonymous support relay through the existing Telegram bot, Worker and D1 with `copyMessage`, encrypted chat routing, deduplication, rate limiting and 30-day cleanup. See `support.md`.
- Admin-facing support headers may show the valid incoming Telegram username next to the unchanged pseudonymous support code. The value is transient and is not stored.
- Deployed the admin-header update to the existing Worker; no D1 migration was required.

## 2026-10-05

- Fixed the fullscreen desktop Home profile capsule touching the first course card by adding a conditional 12px vertical gap; added Chromium/WebKit geometry regressions at 604×424, 1280×800 and 1920×1080.

## 2026-10-05 — final UX/UI/QA release acceptance

- Fixed A11Y-01/A11Y-02 dark-theme action text contrast and A11Y-03 missing 404 `h1`; added axe and route regression tests.
- Final `npm run qa`: 30 Vitest, 54 Node/Worker, validation/build checks and 254/256 Playwright cases passed (two WebKit keyboard skips are host-specific).
- Chromium and WebKit responsive sweep: 118 route/viewport combinations per engine across 320–1920 CSS px plus landscape; no horizontal overflow. Native macOS Safari and Chrome production smoke passed.
- Release status is **PASS WITH KNOWN ISSUES**. Native iOS/Android/iPad/Windows and Telegram WebView verification remain unavailable and explicitly unclaimed; see `testing.md`, `ux-audit.md` and `known-issues.md`.
- Follow-up production retest found and fixed the SDK-present/outside-Telegram theme case: Telegram JS may set a default light scheme even with empty `initData`. Theme params now apply only with actual initData; system dark fallback is preserved. Added SDK-present empty-initData regression plus true Telegram-dark coverage. Cloudflare production smoke on the new asset confirmed dark `color-scheme`, white onboarding action text, working Russian search and 404 recovery. Local full Playwright rerun passed 254/256 at two workers; one transient failure in the initial six-worker run was isolated and did not recur. See the final gate note in `testing.md`.
- GitHub Actions run [37348833831](https://github.com/gregkorneev/iu5hub/actions/runs/37348833831) passed 320/320 browser tests across Chromium, Firefox and WebKit after the fix.

## 2026-10-05

- On portrait phones, removed the excess gap above Home content, set 12px spacing between major sections and aligned the Home stack to the top of available content. Kept compact-screen scrolling and safe-area behavior covered by browser tests; full local `npm run qa` passed (246 Playwright passes, two host-specific WebKit keyboard skips).
- Stabilized Firefox's high-contrast Profile regression by applying the contrast preference before a fresh Home document load; the assertion still requires no blur and an opaque surface. Full CI passed all 310 Playwright tests.
- Header brand (logo + «Студент ИУ5») remains geometrically centered; the admin «Статистика» action is positioned at the header's right edge. Added narrow-screen alignment regressions.
- Home «Избранное» сразу открывает единственную сохранённую папку; один файл или несколько элементов ведут в список профиля. Добавлены два focused Playwright-сценария для прямого перехода и fallback.
- Added the «Диск Белодедова 2026-2027» external link as the first item in the course-2 Electrical Engineering folder; it opens through Telegram's external-link integration.
- Yandex Disk folders with more than four entries use the existing semester folder grid. Home «Курс» labels now share the bold weight of «Избранное», and the Home Profile shortcut shows only the Telegram username without `@`.
- Kept Home tile spacing at 8px on compact screens with natural scrolling when content does not fit; aligned remaining material metadata radius and file-action spacing with design tokens. Audited role-based Liquid Glass opacity and radius tokens against current Apple guidance.
- `npm run qa` passed: 30 Vitest, 54 Node/Worker tests, data validation, production build, and 238/240 Playwright cases (two host-specific WebKit keyboard skips).

## 2026-10-03

- The Home Profile shortcut now uses a compact, right-aligned Liquid Glass bubble. Its identity text and controls stay close together; high-contrast and reduced-transparency settings use a solid fallback.
- In landscape, the Home content now starts below the header with a consistent gap instead of leaving excess vertical space above the profile and course introduction; natural page scrolling remains enabled.
- The cross-browser QA matrix passed in GitHub Actions: 285 Playwright tests across Chromium, Firefox and WebKit. Firefox’s narrow four-tab navigation clipping was fixed, and Firefox-specific fractional CSS-pixel measurement tolerances were added to layout regressions.
- Home profile is on the same row as the introductory text, with description at left and profile at right. The name and Telegram username stack on two lines; the narrower profile column gives the description more width while the avatar and navigation affordance stay visible.
- Home Profile shortcut moved to the right edge, with its identity text on the left and avatar nearest the edge. The visible blue «Курсы» label was removed while its screen-reader heading remains.
- Telegram mobile header brand group is centered beneath the Mini App controls, with the admin Statistics action centered beside it when present.
- Home course tiles now place the colored course number next to “Курс” at matching type sizes, and omit the repeated number from the visible label. The full course title remains available to assistive technology and on the course page.

## 2026-10-03

- Корневой каталог на телефонах теперь использует высоту видимого CSS viewport (`100dvh`), чтобы устаревшее значение Telegram `viewportHeight` не сдвигало ссылки за нижнюю панель. Safe areas продолжают приходить из Telegram; на действительно коротком экране внутренняя прокрутка сохраняется.

## 2026-10-02

- Search suggestions now retain visibility while keyboard focus moves through the suggestion group and close when focus leaves it. A regression test covers Tab navigation in Chromium desktop/mobile and suggestion selection in WebKit.
- Firefox CI caught the 320px «Расписание» tab label exceeding its cell by a few pixels; narrow navigation tabs now have more label space while retaining their existing hit height. The schedule overflow check measures actual inline text ranges instead of the zero `clientWidth` of inline `<small>` text.
- Playwright coverage now includes desktop WebKit in addition to Chromium, mobile Chromium, and mobile WebKit emulation. Ubuntu CI installs Firefox; local Firefox is skipped on macOS due to the OS profile-creation failure.
- Added a successful full cross-browser QA record and documented the remaining physical-device, real Telegram WebView, assistive-technology, local favorites API, and Safari download-permission checks in `wiki/ux-audit.md`, `wiki/testing.md`, and `wiki/known-issues.md`.

- 2026-09-27: Главная адаптирует вертикальные отступы и высоту карточек под эффективную safe-area Telegram, когда на ней показано избранное. На высоких iPhone-подобных viewport контент помещается без внутреннего скролла; на коротких экранах естественная прокрутка сохраняется.
- 2026-09-27: Telegram startup now requests true Bot API fullscreen centrally after `ready()` and `expand()`, falls back to expanded height on unsupported/failure clients and does not re-request after user exit. Device/content safe-area insets and live viewport events feed responsive layout; theme color is sent to Telegram for status/control contrast. API tests/build pass; native clients remain unverified. Current official Web Apps docs document `mode=compact`, not `mode=fullscreen`.
- 2026-09-27: Приветствие на главной выровнено по левому краю основного текста и секции «Курсы» без собственного бокового отступа; мобильный кегль увеличен до 16px.
- 2026-09-27: В полосе выбора даты расписания отключён вертикальный overflow и скрыты системные полосы прокрутки; даты остаются доступны горизонтальным свайпом, вертикально прокручивается только список занятий.
- 2026-09-27: Приветствие на главной увеличено и переведено на основной цвет текста; на обычной высоте добавлено 16px между описанием и секцией «Курсы», с компактным переопределением для коротких экранов. Админская «Статистика» сгруппирована рядом с брендом по центру шапки, чтобы освободить правую область под системные кнопки Telegram.
- 2026-09-27: Область прокрутки занятий расписания на мобильном портрете растянута до нижней навигации вместо прежнего ограничения по высоте; дополнительным парам доступно пустое место внизу экрана. Страница и навигация не прокручиваются вместе со списком.
- 2026-09-27: Логотип и надпись «Студент ИУ5» центрированы в шапке на всех экранах. Приветствие осталось слева; повторный крупный заголовок главной скрыт визуально, но сохранён для скринридеров. В компактной шапке admin Statistics использует 44px icon-only control.
- 2026-09-27: Упрощён верх главной страницы: убраны надписи «Учебные материалы» и «Материалы на Яндекс.Диске», заголовок «Студент ИУ5» поднят сразу под приветствие; «Курсы» остаётся заголовком списка курсов.
- 2026-09-27: Недельный режим расписания показывает семь дат вокруг сегодняшней даты по Москве (−3…+3). Сегодня центрируется и выбирается при открытии; другой выбранный день не сдвигает диапазон, а возврат к «Сегодня» восстанавливает центр. Playwright проверяет даты и поведение в Chromium/WebKit.
- 2026-09-27: Final layout QA fixed the Telegram top safe-area overlap between the sticky header and Profile/Schedule content. Chromium/WebKit regressions cover 320×568 and 390×844; the two-lesson portrait viewport and landscape lesson-only scroll remain passing.
- 2026-09-27: Увеличены вертикальные отступы вокруг блока «Избранное» на обычных мобильных экранах; компактные экраны сохраняют раскладку без прокрутки. Если список избранного пуст, блок на главной скрыт. Проверки охватывают интервалы, empty/populated states и высоту главной.

- 2026-09-27: На главной добавлена компактная ссылка-блок «Избранное» со счётчиком из общего FavoritesContext, между курсами и «Полезными ссылками». Переход ведёт в существующий Профиль; для коротких мобильных экранов сохранена компоновка без скролла.
- 2026-09-26: На главной уточнён вертикальный ритм токенами отступов: приветствие отделено от hero, заголовок — от описания, курсы — от hero; сохранены компактный режим 320×568 и отсутствие прокрутки. Добавлены проверки интервалов и viewport fit до 430 px; `npm run qa` прошёл (132/132 Playwright).
- 2026-09-26: Playwright fixture расписания использует фиксированное время 12:30 по Москве, чтобы synthetic current lesson не пересекала полночь в поздних CI-запусках.
- Mobile scroll pass: Home, Schedule and Profile stop document-level vertical scrolling in portrait Telegram viewports; Home/Profile fit the standard phone layout. Schedule Today keeps two complete lesson cards visible and scrolls additional lessons in a named, keyboard-focusable region, with safe-area spacing above bottom navigation. Week/group selection can use a scoped inner fallback on short screens. Added four-lesson fixture and Playwright viewport/scroll/accessibility regressions. `npm run qa` passed (108 Playwright tests).

## 2026-09-25

- Added the built-in LKS BMSTU schedule route and fourth Liquid Glass destination, group onboarding/search, Today/Week views, Moscow-time current/next lesson states, and a compact profile group preference. Verified the public LKS API and actual ICS endpoint; generated static JSON for 70 IU5 groups (42 calendars, 28 not published). Added parser/validation/safe replacement pipeline, 14-day numerator-gated workflow, and D1 preference migration/API. Migration and Worker are deployed; Pages release is pending QA and push to main.

- Added Telegram-only personal profile and favorites: folder/file heart controls, optimistic synchronization through the existing Worker, D1 storage under a separate stable HMAC identity, profile loading/empty/error states, direct folder navigation and fresh Yandex file URL resolution. Added `0002_favorites.sql`, `USER_ID_HMAC_SECRET` deployment guidance and ADR-0004.
- Production folder search now reads only curated «Теги» and «Преподаватель» values from the 29-folder workbook queue. Both fields are equal, blank cells are excluded, case-insensitive prefix suggestions appear from one character, and selecting one opens its folder directly. A compact local index is generated from the CSV tables; text search does not call Yandex API.
- Fixed search navigation to Yandex Disk: searchable rows retain their display path and now carry the API-relative `diskPath`, omitting the public root name and preserving the leading slash required by Yandex's public-resource endpoint. Reproduced the former 404 and verified the corrected path returns the selected folder.
- Search suggestions and result cards keep tags, teacher values, and API paths hidden while showing the parent course/semester path below each folder name, so duplicates such as «Физика» can be distinguished.
- Fixed favorite-heart overlap in narrow folder cards: the heart shares the top icon row and long folder titles start below it. Added rendered-line intersection checks across catalog, nested folders, files and Profile.
- Standardized folder cards at every viewport width: folder title is left-aligned under its icon and no longer floats in a distant grid column; the favorite control stays at the card's upper-right.
- Moved the server-confirmed admin-only Statistics link from the bottom tab bar to a compact header action at the right of the brand; Catalog, Search and Profile remain the three shared bottom destinations.
- Removed the «К корню курса» shortcut from nested Catalog and Search-result screens, along with its styles. The existing Back button and Telegram BackButton keep using `goBack`.
- Refined the persistent bottom navigation into a compact floating capsule with semicircular ends and a smaller concentric moving selection bubble. Contextual Back action remains visually separate above it; routes, roles, and handlers are unchanged.
- Connected Course 3 to its Yandex Disk folder at `BMSTU/IU5/3 course`; the existing public share root is combined with a nested `rootPath`, so semester folders, nested browsing, downloads and Yandex inventory sync use the correct API paths.

## 2026-09-24

- Обновлён дизайн Telegram Mini App: семантические токены поверх Telegram theme, системный шрифт для основного текста и ALS Sector для бренда, более ясные отступы, спокойные поверхности карточек и поиска, быстрый feedback при касании.
- Добавлены короткие направленные переходы маршрутов с учётом возврата, анимационная замена для `prefers-reduced-motion`, плотный фон без blur для `prefers-reduced-transparency` и усиленные границы для `prefers-contrast`.
- Главная на низком portrait-экране и при фокусе поиска может прокручиваться по вертикали; на обычной высоте сохраняет компоновку внутри Telegram viewport. Обновлены browser-проверки геометрии на 320 px, тем и accessibility preferences.
- Корпоративная тёмная тема получила тёмно-синие поверхности и фирменный синий акцент; режим следует Telegram `colorScheme`, а переключение `themeChanged` dark→light сохраняет введённый поиск и safe-area. Для иконок папок и тихих действий добавлены согласованные цветовые роли. Повторный browser-прогон — 63/63, контраст проверен на 16 сочетаниях темы, ширины и маршрута без нарушений.
- Liquid Glass pass ввёл уровни материала `thin`/`regular`/`thick` для шапки, поиска, подсказок и кнопок возврата, сохранив плотные поверхности карточек. Добавлены непрозрачные fallback для reduced transparency, повышенного контраста и отсутствующего `backdrop-filter`; закреплённая шапка учитывает Telegram safe area и закрывает текст при прокрутке.
- После визуального аудита усилена прозрачность glass-токенов: light `58/70/84%`, dark `66/76/88%` для thin/regular/thick. Поиск сохраняет thin glass при фокусе; режимы fallback, reduced transparency и повышенного контраста остаются непрозрачными.
- Основные действия, активные фильтры и периоды статистики получили фирменную translucent glass-заливку, контрастную подпись, светлый край и blur. Кнопки загрузки и тихое действие используют thin glass; в reduced-transparency и high-contrast сохраняется плотная заливка.
- Glass-система расширена на содержимое: `--material-content` задаёт полупрозрачные поверхности курсов, семестров, предметов, файлов, статистики, деталей материала и empty state; неактивные фильтры и периоды используют `thin`, категории — цветные подложки. Для карточек blur не применяется, а reduced-transparency и high-contrast возвращают плотный фон.
- Mobile-native/UI polish: viewport учитывает клавиатуру и safe area, системный `theme-color` следует теме Telegram, hover оставлен только для точного указателя, устранены tap highlight и выделение текста controls. Навигационная модель и маршруты сохранены; browser regression 69/69.

## 2026-09-23

- Added the CSV-based preparation workflow for manually curated search aliases/keywords, with offline validation/build checks in CI; production search is unchanged.
- Added a 141-folder tagging queue and guarded apply workflow; folder metadata inheritance is represented as source references in the generated index and is not enabled in production search.
- Added a temporary Excel workbook with separate folder-tagging, global-synonym and instruction sheets; importing it updates the CSV source files while keeping the workbook out of Git.

- Поиск по публичному Яндекс.Диску объединяет совпадения из всех подключённых курсов и при общем дедлайне отдаёт уже найденное; добавлены unit и browser regressions.
- Analytics Worker атомарно создаёт пользователя при первом событии, отправляет `/stats` только в личный чат администратора, считает 7/30-дневные метрики по скользящим суткам, ограничивает административные GET-маршруты и прекращает чтение тела события после лимита.
- Опциональные CI deploy jobs получают `VITE_ANALYTICS_API_BASE` из GitHub repository variable и проверяют HTTPS origin до сборки. Документация уточняет, что `CLOUDRU_DEPLOY_ENABLED` тоже должна быть repository variable.
- Wiki приведена к трём курсам: первые два подключены к Яндекс.Диску, третий ждёт публичную ссылку. Отсутствие Cloudflare edge rate limit для аналитики отмечено как открытый риск.

## 2026-09-09

- Published the validated static MVP as a private web deployment.

## Unreleased

- Во второй строке ссылки на GitHub Pages теперь полностью отображается имя «Ю. Е. Гапанюк».
- В landscape-ориентации iPad профиль использует всю доступную ширину Mini App; остальные разделы не затронуты.
- Главные ссылки получили заданный перенос на вторую строку после указанных меток: `Диск ИУ5 от`, `GitHub`, `GitHub Ю.Е`; доступные названия гиперссылок остаются полными.
- «Полезные ссылки» на главной переработаны в крупные translucent glass controls с единым семейством векторных иконок, активным feedback и accessibility fallback; исходные гиперссылки сохранены.

- Заполнен блок «Полезные ссылки»: добавлены кликабельные ссылки на общий Яндекс.Диск ИУ5, GitHub-репозиторий `iu5manual` и GitHub Pages Ю.Е. Гапанюк; Mini App открывает их через Telegram-aware external-link helper.

- Added a three-step first-launch welcome flow for Catalog, Search, Schedule and Profile favorites. Skip, Start and Escape remember completion on the device; existing hash routes remain unchanged, and Telegram BackButton is paused only while the modal is open. Playwright covers persistence, deep links, themes, safe areas and accessibility.

- Documented the private analytics boundary: Worker-validated Telegram identity, HMAC pseudonyms in D1, minimal event schema, defined DAU/WAU/MAU/launch metrics, 90-day raw-event retention, protected admin dashboard and `/stats` webhook.
- Added security, deployment and QA guidance for Worker-only secrets, Telegram/webhook validation, non-admin denial, rate limiting, and isolation of analytics failure from the learning flow.

### Added

- 2026-09-21: добавлены project skill `ui-adversarial-qa`, Playwright 1.63 + axe, deterministic Telegram/Yandex browser fixtures, Chromium/iPhone-like/WebKit matrix и CI Chromium UI gate с failure artifacts.
- 2026-09-21: первый production build опубликован в Cloudflare Pages Direct Upload: `https://iu5hub.pages.dev`; публичная главная страница проверена в Safari.
- 2026-09-11: принят ADR-0003: Студент ИУ5 стал Telegram-first и Telegram-only; Cloud.ru Evolution Object Storage выбран заменяемым technical frontend-hosting, а Яндекс.Диск — хранилищем материалов.
- 2026-09-11: GitHub Actions получил disabled-by-default `deploy-cloudru`: после `verify` он выпускает `dist/` только на push в `main`, через production environment и явный enable variable.
- 2026-09-11: добавлен development-only workflow `npm run dev:telegram`: loopback Vite публикуется во временный Cloudflare Quick Tunnel с HTTP/2 для ручного Telegram test session; production deployment не меняется.

### Changed

- 2026-09-22: файл среди папок семестра занимает полную строку двухколоночной сетки, поэтому длинное имя и кнопка скачивания не сжимаются; добавлена Playwright-проверка на 320 и 390 px.
- 2026-09-21: на узких экранах названия в плитках семестра получили всю ширину после отдельной строки значка; длинные названия не выходят за границы и не разрываются внутри слова.
- 2026-09-21: весь интерфейс переведён на приложенную гарнитуру ALS Sector; подключены локальные файлы Regular, Bold и Stencil.
- 2026-09-21: представление предметов внутри семестра унифицировано в две плитки на строку; распознаются `sem` и `семестр` в любом регистре, а названия папок переносятся только по пробелам.
- 2026-09-21: единый логотип приложения заменён на предоставленный знак «5»; общий asset шапки используется на всех маршрутах.
- 2026-09-21: в landscape-режиме главная страница вновь вертикально прокручивается, если контент не помещается в низкий Telegram viewport; горизонтальная прокрутка остаётся заблокированной.
- 2026-09-21: карточки файлов получили фиксированную правую колонку кнопки скачивания; названия разной длины больше не нарушают симметрию списка.
- 2026-09-21: главная страница теперь фиксируется в Telegram viewport и не допускает вертикальную или горизонтальную прокрутку; добавлена mobile Playwright-регрессия.
- 2026-09-21: подсказки поиска теперь сопоставляют латинскую транслитерацию с кириллическими названиями: запрос `Ma` находит «Математический анализ»; mobile Playwright regression воспроизводит этот ввод и проверяет tappability подсказки.
- 2026-09-21: исправлен переход администратора к статистике с главной: hero больше не перекрывает шапку и не перехватывает касание ссылки; добавлена browser-регрессия для desktop, mobile Chromium и WebKit.
- 2026-09-21: опубликован Cloudflare Worker `iu5hub-analytics`, защищённый Telegram webhook и D1 analytics; production Pages build получил публичный API origin для начала сбора агрегированных метрик после следующего запуска Mini App. Секреты остались только в Worker.
- 2026-09-21: в Cloudflare создана production D1 `iu5hub-analytics`; migration приватной аналитики применена удалённо. Секреты Worker в Git не добавлялись.
- 2026-09-21: добавлена browser-регрессия: ошибка скачивания из уже покинутой папки не отображается в новом каталоге.
- 2026-09-21: на mobile подсказки поиска больше не обрезаются карточкой hero и остаются поверх каталога курсов; добавлен tappability regression.
- 2026-09-21: устранены ARIA listbox defect в поисковых подсказках, отсутствующий H1 на home и stale folder state при быстрых переходах; добавлены browser regressions.
- 2026-09-21: исправлен поиск по Яндекс.Диску: перед сравнением имена приводятся к Unicode NFC (поэтому «Математический» находит папку с декомпозированным `й`); запросы к API ограничены 10 секундами, а сбой одной папки не блокирует поиск. На главной показаны до пяти живых подсказок после ввода двух символов.
- 2026-09-21: поиск переведён с demo-материалов на подключённые публичные каталоги Яндекс.Диска; результат-папка открывается в Mini App, результат-файл скачивается напрямую.
- 2026-09-21: с главной страницы удалён блок «Последние материалы» и его неиспользуемые стили.
- 2026-09-21: файлы из реального каталога Яндекс.Диска загружаются стандартной browser-download ссылкой вместо `Telegram.WebApp.openLink`, обходя 403 Telegram external viewer.
- 2026-09-21: 4-й курс убран из каталога; 1-й курс подключён к публичной папке Яндекс.Диска; 3-й остаётся в каталоге без ссылки до появления материалов.
- 2026-09-21: выполнен адаптивный аудит на ширинах 320, 390, 768 и 1440 px; устранены малые зоны нажатия логотипа, навигации и breadcrumb.
- 2026-09-21: подсказки поиска больше не перекрывают следующий блок страницы и не исчезают при касании в Telegram WebView; выбор подсказки ведёт к материалу или предмету.
- 2026-09-21: Cloudflare Pages URL configured in BotFather; Mini App opened successfully from Telegram. Исправлен порядок загрузки Telegram SDK, из-за которого нативный loader Telegram не закрывался.
- 2026-09-11: Wiki migrated from superseded Web + Telegram / Beget / custom-domain architecture to Telegram Mini App via бота «Студент ИУ5». Старые ADR сохранены как historical decisions и помечены superseded, где применимо.
- 2026-09-08: базовая Wiki, архитектурная карта, roadmap, требования, тестовый и deployment контекст.
- 2026-09-08: React/Vite MVP: каталог, семестры, предметы, категории, карточки материалов, поиск и responsive UI.
- 2026-09-08: `MaterialsRepository`, Web/Telegram `PlatformAdapter`, allowlist `http(s)` for external links, unit tests and GitHub Actions CI.
- 2026-09-08: логотип ИУ5, динамичная космическая тема и сценарий выбора «курс → семестр»; с главной убраны блоки популярных и новых материалов.
- 2026-09-08: тема приведена к официальной палитре МГТУ: `#006CDC`, `#002C5B`, `#8CC5F4`, `#E1EFFB`; визуальная динамика стала светлой и сдержанной.
- 2026-09-08: добавлены 3-й и 4-й курсы (семестры 5–8), защищённые отступы шапки на узких экранах и стилизованное место для будущей ссылки на исходный каталог Яндекс.Диска.
# 2026-09-21

- Поиск Яндекс.Диска теперь продолжает обход совпавшей папки до вложенного совпадающего файла; это возвращает файл УТП из подключённого каталога.
- На главной странице убраны избыточные ссылки шапки «Каталог» и «Поиск»; внутренняя и администраторская навигация сохранена.
- Поиск по публичным каталогам Яндекс.Диска получил общий 10-секундный дедлайн: при зависшем внешнем API UI завершает поиск сообщением об ошибке, а не остаётся в состоянии загрузки.
- Added an empty «Полезные ссылки» section below courses on the home screen so links can be added later without changing catalog navigation.
- 2026-09-25: Schedule/Home/Profile viewport regression pass — Home and Profile fit in standard mobile portrait without page scrolling; Schedule Today and Week/day selection keep two lessons visible on portrait screens, while additional lessons scroll inside the schedule list. Landscape keeps day controls on screen and confines vertical scrolling to lessons. Browser suite passed; actual Telegram WebView remains to be checked on device.
- 2026-09-25: bottom Liquid Glass tab bar now uses four consistent Lucide SVG symbols above the existing labels. The tab list is centralized; active icon tint and the original moving glass indicator show selection. SF Symbols informed semantics, but Apple assets are not bundled in the web app. Admin Statistics remains in the header. 320px geometry and the 46px tab height were checked against Schedule/Profile compact viewport regressions.
# 2026-10-06 — Admin analytics username labels

- Migration `0005_analytics_user_labels.sql` adds a separate table for the current Telegram username keyed by existing analytics `user_hash`; `users` and `events` schemas remain unchanged.
- Protected, paginated admin endpoint and AdminStats section show username, first/last seen and existing launch count. Username is sourced only from Worker-verified `initData`; raw Telegram ID and other profile fields are not stored.
- Existing daily cleanup removes labels after 90 days without verified activity. No historical username backfill is possible.
- Full QA passed; production D1 migration and Worker deployed. Cloudflare Pages deployment `2d999e03` is active on `main`. Production anonymous endpoint smoke passed; valid-admin and physical Telegram checks remain unavailable.
