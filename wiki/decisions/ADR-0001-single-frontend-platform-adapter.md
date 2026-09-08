# ADR-0001: One frontend with a platform adapter

## Context

Student Hub должен работать в browser и Telegram Mini App без расхождения функциональности и UI.

## Decision

Использовать один React/TypeScript/Vite SPA. Компоненты получают platform-capabilities через `PlatformAdapter`; только реализации web/telegram соприкасаются с browser/Telegram APIs.

## Alternatives

Два frontend-проекта; либо прямые Telegram вызовы в компонентах.

## Consequences

Общий routing и бизнес-слой проще проверять и выпускать. Telegram adapter обязан безопасно деградировать за пределами Telegram. Добавление платформы потребует новой реализации, а не переписывания UI.

## Status

Accepted — 2026-09-08.
