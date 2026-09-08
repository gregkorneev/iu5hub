# Current state

- **Project status:** MVP implemented and validated locally.
- **Current milestone:** MVP: каталог материалов для Web и Telegram Mini App.
- **Completed:** React/Vite SPA, routing, static materials repository, Web/Telegram platform adapter, responsive UI, Wiki/ADR, CI, unit tests and local browser smoke test.
- **In progress:** final release commit and push.
- **Next:** replace demo Yandex Disk links with the real catalog; configure Telegram Mini App URL and bot credentials; deploy `dist/` to Beget.
- **Known blockers:** нет опубликованной ссылки/каталога Яндекс.Диска и Telegram bot credentials; MVP использует безопасные демонстрационные записи и не требует их.
- **Important architecture facts:** один SPA frontend; UI зависит только от `MaterialsRepository` и `PlatformAdapter`; тяжёлые файлы остаются на Яндекс.Диске.
- **Last significant change:** 2026-09-08 — added supplied IU5 logo, animated dark theme, and course-to-semester navigation.
