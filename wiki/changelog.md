# Changelog

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
