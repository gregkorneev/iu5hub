# Deployment

## Target

Beget FreeHosting обслуживает статический Vite build. В репозиторий не публикуются тяжёлые учебные файлы, токены и приватные ключи.

## Release procedure

1. Установить lockfile-зависимости и запустить lint, typecheck, test, build.
2. Загрузить содержимое production output (обычно `dist/`) в web root Beget.
3. Настроить SPA fallback: неизвестные application routes отдают `index.html`, существующие assets — напрямую.
4. Открыть `/`, прямой `/subject/...`, `/material/...` и внешнюю ссылку; затем проверить URL в Telegram Mini App.

## Configuration

`.env` игнорируется Git; только публичные Vite-переменные могут попасть в клиентский bundle. `.env.example` содержит лишь имена и безопасные примеры. Настоящие bot/API secrets требуют внешнего защищённого хранения и backend, а не frontend.
