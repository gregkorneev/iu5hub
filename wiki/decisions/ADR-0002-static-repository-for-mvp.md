# ADR-0002: Static materials repository for MVP

## Context

На момент решения Beget FreeHosting рассматривался как static frontend hosting, а контент Диска ещё не был предоставлен. В новой архитектуре Cloud.ru Evolution Object Storage заменяет Beget; необходимость статического каталога для MVP сохраняется.

## Decision

MVP хранит компактный каталог в versioned local JSON/TypeScript data за async `MaterialsRepository`. Для структуры «четыре курса» конфигурация содержит четыре корневых папки/публичных ссылки, а данные могут содержать снимок их вложенных каталогов. Сами учебные файлы остаются по внешним ссылкам на Яндекс.Диске.

## Alternatives

Сразу строить backend/БД/синхронизацию Яндекс.Диска; импортировать JSON непосредственно из компонентов.

## Consequences

Каталог запускается без секретов, оплаты и backend. Появление нового файла на Диске не меняет статический снимок автоматически: его нужно обновить в Git либо заменить repository implementation. Для опубликованных read-only папок такая реализация может читать публичный каталог без токена; для private/authenticated live-каталога требуется backend, где хранятся токены и валидируется Telegram `initData`. В обоих случаях UI contract не меняется. Автосинхронизация остаётся P3, пока она не запрошена как отдельный scope.

## Superseded by

ADR-0003-telegram-only-cloudru-yandex-disk.md заменяет hosting и product-entry assumptions. Решение использовать static `MaterialsRepository` до появления backend/sync остаётся актуальным и повторно подтверждено новым ADR.

## Status

Superseded in part — 2026-09-11 (historical record retained; repository decision remains reaffirmed by ADR-0003).
