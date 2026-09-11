# Testing

## Required release gate

Если инструменты настроены, до commit/push должны пройти `lint`, `typecheck`, `test`, `build`.

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
