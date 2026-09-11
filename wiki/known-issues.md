# Known issues

| Status | Issue | Impact / resolution |
| --- | --- | --- |
| Open | Cloud.ru deployment not provisioned; Environment intentionally disabled | `cloudru-production` already exists with `CLOUDRU_DEPLOY_ENABLED=false`. Нужны dedicated bucket, Static Website Hosting with HTTPS plus index/error documents, secrets `CLOUDRU_ACCESS_KEY_ID`/`CLOUDRU_SECRET_ACCESS_KEY`/`CLOUDRU_BUCKET`, optional variable `CLOUDRU_PREFIX`, then reviewed enablement to `true`. До этого `deploy-cloudru` корректно пропускается. |
| Open | Первый Cloud.ru deploy и rollback ещё не проверены | Workflow делает destructive `aws s3 sync --delete` только внутри configured target/prefix, генерирует `error.html`, cache-ит `assets/` immutable и публикует `index.html` последним. До первой controlled deploy нельзя утверждать endpoint, cache headers или rollback. Нужны dedicated bucket/prefix и включённое versioning. |
| Open | Нет доступа к Telegram bot/реального launch URL | Невозможно подтвердить поведение в настоящих Telegram clients до настройки HTTPS URL Mini App в BotFather/боте. Bot token не должен передаваться во frontend. |
| Open | Нет согласованного каталога Яндекс.Диска | Использовать demo data; заменить через repository/data source после появления ссылок. |
