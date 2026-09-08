# Data model

## Entities

| Entity | Required fields | Notes |
| --- | --- | --- |
| Semester | `number`, `title` | учебный семестр |
| Subject | `id`, `slug`, `title`, `semester` | `slug` используется в URL |
| Material | `id`, `title`, `subjectId`, `category`, `url` | `description?`, `keywords?`, `createdAt?` |

`category`: `lecture`, `lab`, `practice`, `methodical`, `presentation`, `video`, `book`, `additional`, `other`.

## Repository contract

`MaterialsRepository` предоставляет асинхронное чтение предметов и материалов и поиск. UI не импортирует JSON напрямую. MVP-реализация читает локальные данные; будущий API repository сохраняет тот же контракт.

## URL safety

Ссылки материалов — абсолютные `https:` ссылки на доверенный источник. Некорректная/отсутствующая ссылка не должна открываться; показывается понятное состояние.
