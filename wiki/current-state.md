# Current state

- **Project status:** MVP implemented and validated locally.
- **Current milestone:** MVP: каталог материалов для Web и Telegram Mini App.
- **Completed:** React/Vite SPA, routing, static materials repository, Web/Telegram platform adapter, responsive UI, Wiki/ADR, CI, unit tests and local browser smoke test.
- **In progress:** preparation of the Beget FreeHosting release and integration with the real catalog.
- **Next:** upload the validated `dist/` contents to Beget after hosting access is supplied; replace demo Yandex Disk links with the real catalog; configure the HTTPS custom-domain URL in Telegram Mini App and bot credentials.
- **Known blockers:** нет опубликованной ссылки/каталога Яндекс.Диска и Telegram bot credentials; MVP использует безопасные демонстрационные записи и не требует их.
- **Important architecture facts:** один SPA frontend; UI зависит только от `MaterialsRepository` и `PlatformAdapter`; тяжёлые файлы остаются на Яндекс.Диске.
- **Team workflow:** постоянная небольшая команда; новые роли создаются только для действительно новой специализации, а обычные задачи направляются существующим агентам.
- **Last significant change:** 2026-09-08 — navigation now exposes four courses (semesters 1–8); the header retains protected horizontal insets at narrow widths, and the footer includes a styled placeholder for the future source Yandex Disk catalog link. The visual theme remains aligned to the official BMSTU palette (#006CDC, #002C5B, #8CC5F4, #E1EFFB), supports automatic light/dark appearance through `prefers-color-scheme`, and retains the animated, reduced-motion-safe interface.
- **Deployment policy:** 2026-09-09 — the target is Beget FreeHosting; `public/.htaccess` provides the SPA fallback and `.env.example` documents `VITE_APP_PUBLIC_URL`. A previous private Sites preview is not a production endpoint and must not be shared.
