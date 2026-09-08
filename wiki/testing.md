# Testing

## Required release gate

Если инструменты настроены, до commit/push должны пройти `lint`, `typecheck`, `test`, `build`.

## Minimum automated coverage

- repository: поиск по title/subject/category/keywords и пустой результат;
- platform: web fallback и Telegram detection без `window.Telegram`;
- routes: known material/subject и not-found/empty states.

## Manual smoke matrix

| Scenario | Web desktop | Mobile/Telegram |
| --- | --- | --- |
| Home → semester → subject → material | required | required |
| Search, empty and long query | required | required |
| Direct deep link / refresh | required | required where supported |
| External material link | required | required |
| Keyboard/focus and touch targets | required | required |

Записывайте невыполнимые проверки и причину в `known-issues.md`.
