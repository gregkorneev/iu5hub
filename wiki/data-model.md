# Data model

## Entities

| Entity | Required fields | Notes |
| --- | --- | --- |
| Course | `id`, `title`, `root` | Один из четырёх постоянных курсов; `root` описывает корневую папку Яндекс.Диска, а не URL отдельного файла. |
| Semester | `number`, `title` | учебный семестр |
| Subject | `id`, `slug`, `title`, `semester` | `slug` используется в URL |
| Material | `id`, `title`, `subjectId`, `category`, `url` | `description?`, `keywords?`, `createdAt?` |
| Catalog node | `id`, `title`, `kind`, `path` | Дерево, полученное из папки курса: `folder` становится каталогом, `file` — открываемым материалом. |

`category`: `lecture`, `lab`, `practice`, `methodical`, `presentation`, `video`, `book`, `additional`, `other`.

## Search metadata (preparation stage)

Ручные теги будущего интеллектуального поиска хранятся в version-controlled CSV (`data/search/search-tags.csv` и `search-synonyms.csv`), а не в production D1. Объект каталога идентифицируется `object_key`; текущая стратегия использует стабильный ID только если публичный Yandex Disk API его подтверждает как пригодный для rename/move, иначе — детерминированный ключ от `course_id + path`. Поэтому rename/move может потребовать ручного переноса тегов. См. [search.md](search.md).

Будущая D1 mapping: `search_metadata(object_key, course_id, type, path, name, aliases, keywords, teacher, priority, enabled, inherit, notes, source_status)` и отдельная `search_synonyms(term, synonyms, enabled, notes)`. Поле `teacher` хранит имя или имена преподавателей как поисковую метаинформацию. Это схема-план; миграции и поисковой D1 сейчас нет.

## Four-course Disk catalog

Конфигурация MVP задаёт ровно четыре `Course` с независимыми корневыми папками Яндекс.Диска. Они образуют постоянные кнопки первого экрана. Всё ниже корня не описывается вручную в UI: подпапки показываются как вложенные каталоги, а файлы — как материалы. Следовательно, добавление папки или файла в корневую структуру Диска должно отразиться после следующего обновления каталога без изменения React-компонентов.

Для статической реализации допустимо versioned-конфигурацией хранить только четыре публичных root URL/идентификатора и заранее подготовленный снимок дерева. Это не является live-синхронизацией: чтобы новые файлы появлялись сами, repository должен уметь получить актуальный список содержимого корневой папки и дочерних папок.

## Repository contract

`MaterialsRepository` предоставляет асинхронное чтение курсов, каталога, предметов и материалов и поиск. UI не импортирует JSON напрямую. MVP-реализация читает локальные данные; будущий Yandex Disk/API repository сохраняет тот же контракт. Ошибка одной папки не должна скрывать остальные три курса: repository возвращает понятное состояние загрузки/ошибки для затронутого узла.

## Source and credential boundary

Если все четыре папки опубликованы для чтения, repository может получать их метаданные через публичный интерфейс Яндекс.Диска без секретов, но открывать пользователю разрешается только проверенные `https:` ссылки Яндекс.Диска. Публичные ключи/URL не дают права записи и могут быть включены в frontend как контентная конфигурация.

Для непубличных папок, персональных прав доступа, OAuth-токена, записи или надёжной live-синхронизации нужен backend. Он хранит токен Яндекс.Диска вне Git и frontend bundle, получает дерево по API, при необходимости кэширует/нормализует его и отдаёт клиенту только разрешённый каталог и ссылки. Если backend использует Telegram identity или доступы, он сначала валидирует `initData` на сервере; клиентские `initData` и `user` не являются авторизацией.

## URL safety

Ссылки материалов — абсолютные `https:` ссылки на доверенный источник. Некорректная/отсутствующая ссылка не должна открываться; показывается понятное состояние.

## Private analytics data (D1)

Analytics D1 is independent of the read-only materials repository and contains no Telegram profile record.

| Table | Fields | Purpose |
| --- | --- | --- |
| `users` | `user_hash` PK, `first_seen_at`, `last_seen_at`, `launch_count` | one pseudonymous row per validated Telegram user; a repeat open updates it |
| `events` | `id` PK, `user_hash`, `event_type`, `subject_id` nullable, `material_id` nullable, `event_minute`, `created_at` | compact allowlisted activity events; minute bucket supports event deduplication |

`user_hash` is `HMAC-SHA-256(verified Telegram user.id, ANALYTICS_HMAC_SECRET)`, encoded for storage. Raw Telegram IDs are used only during Worker processing and are neither stored nor returned. Plain SHA-256 is prohibited because a Telegram ID is enumerable.

Only `app_open`, `search`, `subject_open`, `material_open`, and `yandex_disk_open` are valid types. IDs are optional only where an event needs none, are strictly limited internal repository IDs, and never duplicate a title or Disk URL. `search` has no query-text field. The shipped migration indexes `events(created_at)` plus subject/material popularity fields; add an index on `users(last_seen_at)` only if query-plan evidence requires it.
