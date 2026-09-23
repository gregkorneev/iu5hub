# Architecture

## Scope

Статический React + TypeScript + Vite SPA, запускаемый только как Telegram Mini App. Cloudflare Pages отдаёт production artifact по HTTPS, но не является пользовательской точкой входа: студент начинает путь в боте «Студент ИУ5».

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

### Private analytics boundary

```text
Telegram Mini App (initData + allowlisted event)
        ↓ HTTPS
Cloudflare Worker /api/*
        ↓ validate Telegram initData; derive HMAC user_hash
Cloudflare D1 (users, events)

Telegram Bot API → Worker /telegram/webhook → protected /stats response
```

- Pages continues to serve only static `dist/`; the D1 binding, bot token, webhook secret, admin allowlist and HMAC key exist only in the Worker.
- The browser submits original Telegram `initData`; `initDataUnsafe`, a Telegram ID, and an admin flag from the browser cannot authenticate anything. The Worker validates signature and freshness, then derives a keyed HMAC pseudonym from trusted `user.id`.
- Analytics accepts only allowlisted event types and bounded internal material/subject IDs. It never accepts Disk URLs, display titles, arbitrary event values or Telegram profile fields.
- Event delivery is best-effort. An analytics error must not delay navigation or opening a material/Disk link.
- Each `/api/admin/*` request separately validates `initData` and checks the trusted ID against a server-side allowlist. Page visibility in React is UX only.

- UI не обращается к `window.Telegram` и не знает детали загрузки данных; Telegram API инкапсулирован в едином integration layer (`init`, user, theme, navigation, links или эквивалентная структура).
- Repository возвращает доменные сущности; статическая JSON-реализация заменяема API-реализацией.
- Корневой каталог состоит из конфигурируемых `Course` (сейчас их три). UI рендерит их постоянными точками входа, а repository сопоставляет вложенные папки Яндекс.Диска с каталогами и файлы — с материалами. Компонентам неизвестны URL, public keys и способ обхода дерева.
- Integration layer инкапсулирует initialization/`ready()`, theme, viewport/safe areas, BackButton, external links, user context, close и необязательный haptic. Он адаптирует UI к Compact, Fullsize и Fullscreen по событиям viewport/safe area, но не запрашивает `expand()` или fullscreen автоматически.
- React Router отвечает за внутреннюю навигацию. Используется `HashRouter`, поэтому Cloudflare Pages не требует provider-specific SPA fallback для клиентских маршрутов.

## Hosting boundary

Cloudflare Pages хранит только `dist/`: HTML, JS/CSS bundles, icons, small images и статические JSON/data files. Материалы не копируются туда без отдельного решения: карточка материала открывает проверенную внешнюю ссылку Яндекс.Диска через Telegram integration layer. Provider-specific URL и business logic не hardcode-ятся в UI; смена host не должна менять публичную ссылку на бот.

Для опубликованных read-only папок допустим frontend repository, который использует публичный каталог Яндекс.Диска и не требует OAuth-секрета. Сейчас подключены каталоги первого и второго курсов; третий курс ждёт публичную ссылку. Это подходит только для общедоступного контента и имеет ограничения браузерной сети/API. Если папки непубличны, требуется авторизованный доступ, запись, персональные права или контролируемое кэширование, появляется отдельный backend: `UI → MaterialsRepository → backend catalog API → Yandex Disk API`. Backend — единственное место для токена Диска и server-side проверки Telegram `initData`; он возвращает нормализованное дерево, а не передаёт токен клиенту.

## Non-goals MVP

Публичный website, landing page, Taplink, собственный домен как обязательная пользовательская точка входа, хранение избранного, роли, Docker и сложное глобальное состояние не создаются до появления подтверждённой необходимости. Analytics Worker — не общий пользовательский backend и не защищённый каталог Диска: это минимальный доверенный контур для приватной статистики и `/stats`. Backend для non-public/authorized каталога остаётся отдельным scope.
