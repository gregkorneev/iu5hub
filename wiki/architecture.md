# Architecture

## Scope

Статический React + TypeScript + Vite SPA, запускаемый только как Telegram Mini App. Cloud.ru Evolution Object Storage отдаёт production artifact по HTTPS, но не является пользовательской точкой входа: студент начинает путь в Student Hub Bot.

## Boundaries

```text
pages/components (UI)
        ↓
domain/services (use cases)
        ↓
repositories (MaterialsRepository)
        ↓
static JSON / future API

UI → Telegram integration layer → Telegram WebApp API
```

- UI не обращается к `window.Telegram` и не знает детали загрузки данных; Telegram API инкапсулирован в едином integration layer (`init`, user, theme, navigation, links или эквивалентная структура).
- Repository возвращает доменные сущности; статическая JSON-реализация заменяема API-реализацией.
- Integration layer инкапсулирует initialization/`ready()`, theme, viewport/safe areas, BackButton, external links, user context, close и необязательный haptic.
- React Router отвечает за внутреннюю навигацию. Используется `HashRouter`, поэтому Cloud.ru static hosting не требует provider-specific SPA fallback для клиентских маршрутов.

## Hosting boundary

Cloud.ru хранит только `dist/`: HTML, JS/CSS bundles, icons, small images и статические JSON/data files. Материалы не копируются туда без отдельного решения: карточка материала открывает проверенную внешнюю ссылку Яндекс.Диска через Telegram integration layer. Provider-specific URL и business logic не hardcode-ятся в UI; смена host не должна менять публичную ссылку на бот.

## Non-goals MVP

Публичный website, landing page, Taplink, собственный домен как обязательная пользовательская точка входа, backend, авторизация, синхронизация Диска, хранение избранного, роли, Docker и сложное глобальное состояние не создаются до появления подтверждённой необходимости.
