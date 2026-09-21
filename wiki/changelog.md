# Changelog

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
