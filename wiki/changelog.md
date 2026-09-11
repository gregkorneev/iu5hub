# Changelog

## 2026-09-09

- Published the validated static MVP as a private web deployment.

## Unreleased

### Added

- 2026-09-11: принят ADR-0003: Student Hub стал Telegram-first и Telegram-only; Cloud.ru Evolution Object Storage выбран заменяемым technical frontend-hosting, а Яндекс.Диск — хранилищем материалов.
- 2026-09-11: GitHub Actions получил disabled-by-default `deploy-cloudru`: после `verify` он выпускает `dist/` только на push в `main`, через production environment и явный enable variable.
- 2026-09-11: добавлен development-only workflow `npm run dev:telegram`: loopback Vite публикуется во временный Cloudflare Quick Tunnel с HTTP/2 для ручного Telegram test session; production deployment не меняется.

### Changed

- 2026-09-11: Wiki migrated from superseded Web + Telegram / Beget / custom-domain architecture to Telegram Mini App via Student Hub Bot. Старые ADR сохранены как historical decisions и помечены superseded, где применимо.
- 2026-09-08: базовая Wiki, архитектурная карта, roadmap, требования, тестовый и deployment контекст.
- 2026-09-08: React/Vite MVP: каталог, семестры, предметы, категории, карточки материалов, поиск и responsive UI.
- 2026-09-08: `MaterialsRepository`, Web/Telegram `PlatformAdapter`, allowlist `http(s)` for external links, unit tests and GitHub Actions CI.
- 2026-09-08: логотип ИУ5, динамичная космическая тема и сценарий выбора «курс → семестр»; с главной убраны блоки популярных и новых материалов.
- 2026-09-08: тема приведена к официальной палитре МГТУ: `#006CDC`, `#002C5B`, `#8CC5F4`, `#E1EFFB`; визуальная динамика стала светлой и сдержанной.
- 2026-09-08: добавлены 3-й и 4-й курсы (семестры 5–8), защищённые отступы шапки на узких экранах и стилизованное место для будущей ссылки на исходный каталог Яндекс.Диска.
