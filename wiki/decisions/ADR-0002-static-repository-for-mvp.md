# ADR-0002: Static materials repository for MVP

## Context

На момент решения Beget FreeHosting рассматривался как static frontend hosting, а контент Диска ещё не был предоставлен. В новой архитектуре Cloud.ru Evolution Object Storage заменяет Beget; необходимость статического каталога для MVP сохраняется.

## Decision

MVP хранит компактный каталог в versioned local JSON/TypeScript data за async `MaterialsRepository`. Сами учебные файлы остаются по внешним ссылкам на Яндекс.Диске.

## Alternatives

Сразу строить backend/БД/синхронизацию Яндекс.Диска; импортировать JSON непосредственно из компонентов.

## Consequences

Каталог запускается без секретов, оплаты и backend. При появлении API требуется новая repository implementation; UI contract не меняется. Автосинхронизация остаётся P3.

## Superseded by

ADR-0003-telegram-only-cloudru-yandex-disk.md заменяет hosting и product-entry assumptions. Решение использовать static `MaterialsRepository` до появления backend/sync остаётся актуальным и повторно подтверждено новым ADR.

## Status

Superseded in part — 2026-09-11 (historical record retained; repository decision remains reaffirmed by ADR-0003).
