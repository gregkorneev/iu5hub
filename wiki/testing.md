# Testing

## Required release gate

Если инструменты настроены, до commit/push должны пройти `lint`, `typecheck`, `test`, `build`.

`verify` — обязательный GitHub Actions gate для всех push и pull request. `deploy-cloudru` не является доказательством готовности, пока не выполнен: он запускается только после успешного `verify`, на push в `main`, при `CLOUDRU_DEPLOY_ENABLED == 'true'` и с configured production environment.

## Minimum automated coverage

- repository: поиск по title/subject/category/keywords и пустой результат;
- Telegram integration: безопасная инициализация, theme/navigation/link abstraction и developer fallback без `window.Telegram`;
- routes: known material/subject и not-found/empty states.

## Manual smoke matrix

| Scenario | Local developer browser | Telegram iOS/Android/Desktop/Web |
| --- | --- | --- |
| Home → semester → subject → material | useful | required |
| Search, empty and long query | useful | required |
| Internal route / reopen | useful | required where supported |
| External Yandex Disk link | useful | required |
| Theme, viewport, safe areas, BackButton | n/a | required |
| Keyboard/focus and touch targets | useful | required |

Записывайте невыполнимые проверки и причину в `known-issues.md`.

## Production smoke after deploy

- GitHub Actions: `verify` и `deploy-cloudru` completed successfully; в deploy log подтверждены target bucket/prefix без раскрытия secrets.
- Cloud.ru: HTTPS endpoint возвращает актуальные `index.html`, `error.html`, hashed JS/CSS assets и `logo-iu5.jpeg`; `index.html` имеет `no-cache, no-store, must-revalidate`, assets — `public, max-age=31536000, immutable`, root files — `no-cache`.
- Routing: открыть base endpoint и deep HashRouter URL вида `/#/material/<id>`; Static Website Hosting должен отдавать `index.html` для base endpoint.
- Telegram: технический HTTPS endpoint задан как Mini App URL и проверен в iOS, Android, Desktop и Web.
- Rollback: перед release известен last-known-good commit/artifact; bucket versioning включён или прошлый artifact хранится отдельно от deploy target.
