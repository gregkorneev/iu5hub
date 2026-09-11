# ADR-0001: One frontend with a platform adapter

## Context

На момент решения «ИУ5 Архив» должен был работать в browser и Telegram Mini App без расхождения функциональности и UI.

## Decision

Использовать один React/TypeScript/Vite SPA. Компоненты получают platform-capabilities через `PlatformAdapter`; только реализации web/telegram соприкасаются с browser/Telegram APIs.

## Alternatives

Два frontend-проекта; либо прямые Telegram вызовы в компонентах.

## Consequences

Общий routing и бизнес-слой проще проверять и выпускать. Telegram adapter обязан безопасно деградировать за пределами Telegram. Добавление платформы потребует новой реализации, а не переписывания UI.

## Superseded by

ADR-0003-telegram-only-cloudru-yandex-disk.md. Новый продукт не поддерживает отдельный публичный Web runtime, поэтому `WebPlatformAdapter` больше не является целевой границей. Принцип централизации browser/Telegram API в UI сохраняется и развивается в Telegram integration layer.

## Status

Superseded — 2026-09-11 (historical record retained).
