# Current state

- **Project status:** Telegram-only MVP мигрирован и validated locally; внешний production release ожидает доступы и настройки.
- **Current milestone:** Telegram Mini App: каталог материалов, Cloud.ru Evolution Object Storage deployment и реальный каталог Яндекс.Диска.
- **Completed:** React/Vite SPA, routing, статический `MaterialsRepository`, responsive UI, CI, unit tests и локальный browser smoke test. Эти результаты требуют адаптации к новой Telegram-only границе, а не считаются production validation в Telegram.
- **In progress:** подготовка внешнего Cloud.ru deployment, BotFather Mini App URL и реального каталога Яндекс.Диска.
- **Next:** заменить demo-ссылки реальным каталогом Яндекс.Диска; создать HTTPS endpoint static website в Cloud.ru; задать URL Mini App в BotFather/боте; добавить GitHub Actions Secrets и включить deploy после успешного verify.
- **Known blockers:** для внешнего release нужны Cloud.ru Object Storage credentials/configuration, Telegram bot access и реальный каталог Яндекс.Диска. Ни один secret не должен попадать в Git или frontend bundle.
- **Important architecture facts:** один статически собираемый React/TypeScript/Vite frontend существует только внутри Telegram Mini App; UI зависит от `MaterialsRepository` и централизованного Telegram integration layer; Cloud.ru — заменяемый technical host; тяжёлые файлы остаются на Яндекс.Диске.
- **Team workflow:** постоянная небольшая команда; новые роли создаются только для действительно новой специализации, а обычные задачи направляются существующим агентам.
- **Last significant change:** 2026-09-11 — принята целевая Telegram-only архитектура: Telegram Bot является постоянной публичной точкой входа, Cloud.ru Evolution Object Storage — только техническим hosting, Яндекс.Диск — файловым хранилищем (ADR-0003). Документация старого Beget/Web решения помечена superseded.
- **Deployment policy:** production artifact — содержимое `dist/`, публикуемое в Cloud.ru Evolution Object Storage со Static Website Hosting и HTTPS. Технический Cloud.ru URL не распространяется студентам; Bot/Mini App URL остаётся пользовательским входом.
