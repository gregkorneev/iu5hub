# Agent handoffs

## 2026-09-08 — Wiki / Context Keeper

- **Task:** создать начальную долговременную память для нового репозитория «ИУ5 Архив».
- **Result:** создана компактная Wiki и два ADR; зафиксированы MVP границы и реальные внешние блокеры.
- **Files:** `wiki/`.
- **Important notes:** документация предполагает один SPA frontend, статический data source и platform adapter; не конфликтует с параллельной frontend реализацией.
- **Follow-up:** после интеграции реализации сверить Wiki с фактическими путями, командами и результатами проверок.

## 2026-09-11 — Architecture / Wiki migration

- **Task:** заменить устаревшую public Web + Telegram / Beget архитектуру на принятую Telegram-only архитектуру, не удаляя исторические ADR.
- **Result:** ADR-0003 принят; current architecture и deployment docs описывают бот «Студент ИУ5» → Telegram Mini App → Cloud.ru Evolution Object Storage, с Яндекс.Диском как storage материалов. ADR-0001 и ADR-0002 сохранены и помечены superseded в изменённых частях.
- **Migration plan:** (1) frontend/Telegram specialist удаляет `WebPlatformAdapter` и переносит Telegram interaction в единый layer; (2) DevOps заменяет Beget-specific files/config на Cloud.ru static hosting и CI deploy, когда credentials доступны; (3) Data specialist сохраняет `MaterialsRepository`, заменяя demo catalog после выдачи ссылок Яндекс.Диска; (4) QA/security выполняют Telegram-client и external-link checks; (5) Wiki agent сверяет финальную реализацию с ADR-0003.
- **External blockers:** нужны Cloud.ru bucket/HTTPS endpoint и GitHub Secrets, доступ к настройке Telegram bot/Mini App URL, а также реальный каталог Яндекс.Диска. Bot token никогда не добавляется в frontend.

## 2026-09-08 — MVP integration

- **Task:** реализовать и проверить первый MVP «ИУ5 Архив».
- **Result:** реализован единый SPA для Web и Telegram, каталог демонстрационных материалов, поиск, CI и базовые тесты; lint, typecheck, test и production build проходят.
- **Files:** `src/`, `.github/workflows/ci.yml`, `package.json`, `wiki/`.
- **Important notes:** Telegram user data используется только для UI; настоящие ссылки Яндекс.Диска и настройки Telegram ещё требуются для публикации.
- **Follow-up:** historical record only; its Web/Telegram and Beget deployment assumptions are superseded by ADR-0003. Replace demo data and release through Cloud.ru when the external access is available.
