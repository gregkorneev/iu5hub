# Architecture

## Scope

Статический React + TypeScript + Vite SPA, пригодный для размещения на Beget. Один код обслуживает browser и Telegram WebView.

## Boundaries

```text
pages/components (UI)
        ↓
domain/services (use cases)
        ↓
repositories (MaterialsRepository)
        ↓
static JSON / future API

UI → PlatformAdapter → web | telegram
```

- UI не обращается к `window.Telegram` и не знает детали загрузки данных.
- Repository возвращает доменные сущности; статическая JSON-реализация заменяема API-реализацией.
- Platform adapter инкапсулирует ссылки, пользователя, закрытие и необязательный haptic.
- React Router отвечает за читаемые deep links; серверу нужен SPA fallback на `index.html`.

## Non-goals MVP

Backend, авторизация, синхронизация Диска, хранение избранного, роли, Docker и сложное глобальное состояние не создаются до появления подтверждённой необходимости.
