# Architecture

## Scope

Статический React + TypeScript + Vite SPA, запускаемый только как Telegram Mini App. Cloud.ru Evolution Object Storage отдаёт production artifact по HTTPS, но не является пользовательской точкой входа: студент начинает путь в боте «Студент ИУ5».

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
- Корневой каталог состоит из четырёх конфигурируемых `Course`. UI рендерит их постоянными точками входа, а repository сопоставляет вложенные папки Яндекс.Диска с каталогами и файлы — с материалами. Компонентам неизвестны URL, public keys и способ обхода дерева.
- Integration layer инкапсулирует initialization/`ready()`, theme, viewport/safe areas, BackButton, external links, user context, close и необязательный haptic. Он адаптирует UI к Compact, Fullsize и Fullscreen по событиям viewport/safe area, но не запрашивает `expand()` или fullscreen автоматически.
- React Router отвечает за внутреннюю навигацию. Используется `HashRouter`, поэтому Cloud.ru static hosting не требует provider-specific SPA fallback для клиентских маршрутов.

## Hosting boundary

Cloud.ru хранит только `dist/`: HTML, JS/CSS bundles, icons, small images и статические JSON/data files. Материалы не копируются туда без отдельного решения: карточка материала открывает проверенную внешнюю ссылку Яндекс.Диска через Telegram integration layer. Provider-specific URL и business logic не hardcode-ятся в UI; смена host не должна менять публичную ссылку на бот.

Для четырёх опубликованных read-only папок допустим frontend repository, который использует публичный каталог Яндекс.Диска и не требует OAuth-секрета. Это подходит только для общедоступного контента и имеет ограничения браузерной сети/API. Если папки непубличны, требуется авторизованный доступ, запись, персональные права или контролируемое кэширование, появляется отдельный backend: `UI → MaterialsRepository → backend catalog API → Yandex Disk API`. Backend — единственное место для токена Диска и server-side проверки Telegram `initData`; он возвращает нормализованное дерево, а не передаёт токен клиенту.

## Non-goals MVP

Публичный website, landing page, Taplink, собственный домен как обязательная пользовательская точка входа, хранение избранного, роли, Docker и сложное глобальное состояние не создаются до появления подтверждённой необходимости. Backend, авторизация и синхронизация Диска также не входят в статический MVP, но становятся отдельным обязательным scope при выборе непубличного или authenticated live-каталога.
