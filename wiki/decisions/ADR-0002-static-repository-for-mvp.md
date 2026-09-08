# ADR-0002: Static materials repository for MVP

## Context

Beget FreeHosting подходит для статического frontend, но не для обязательного backend/sync процесса; контент Диска ещё не предоставлен.

## Decision

MVP хранит компактный каталог в versioned local JSON/TypeScript data за async `MaterialsRepository`. Сами учебные файлы остаются по внешним ссылкам на Яндекс.Диске.

## Alternatives

Сразу строить backend/БД/синхронизацию Яндекс.Диска; импортировать JSON непосредственно из компонентов.

## Consequences

Каталог запускается без секретов, оплаты и backend. При появлении API требуется новая repository implementation; UI contract не меняется. Автосинхронизация остаётся P3.

## Status

Accepted — 2026-09-08.
