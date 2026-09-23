# Подготовка ручных метаданных поиска

## Поток данных

```text
Публичный Яндекс.Диск
        ↓ npm run search:sync (ручная сеть)
data/search/search-tags.csv (catalog inventory and ручные поля in one table)
        ↓ ручное заполнение aliases / keywords / priority / enabled / notes
npm run search:validate
        ↓ npm run search:build
src/generated/search-index.json
        ↓
npm run search:coverage
```

`search:sync` обходит публичные каталоги, заданные в конфигурации курсов. Курс без корректной публичной ссылки пропускается. Sync обновляет машинные поля и сохраняет заполненные вручную данные по совпавшему `object_key`; исчезнувшие объекты остаются в таблице с `source_status=missing`, чтобы метаданные не терялись. Переименование или перенос может изменить ключ, если публичный API не даёт пригодного стабильного идентификатора. В таком случае старые метаданные сохраняются как missing, а новый объект появляется отдельной строкой; предупреждение о возможном совпадении не переносит метаданные автоматически.

## Таблицы

Основной файл для владельца — `data/search/search-tags.csv`. Откройте его в Numbers, Excel, LibreOffice или импортируйте в Google Sheets. Редактируйте только `aliases`, `keywords`, `priority`, `enabled` и `notes`. В списках используйте `;` как разделитель, например `матан; мат анализ`. Пустые поля допустимы; новая строка по умолчанию включена с приоритетом 0.

`data/search/search-synonyms.csv` предназначен для глобальных соответствий, не привязанных к отдельной папке. Исходные таблицы — единственный source of truth на этом этапе. Они не переключают и не изменяют production-поиск.

## Команды

- `npm run search:sync` — получить актуальный каталог; требует доступа к сети и запускается вручную.
- `npm run search:validate` — проверить CSV и соответствие строк локальному снимку каталога.
- `npm run search:build` — собрать machine-readable индекс из таблиц и каталога; сеть не нужна.
- `npm run search:build:check` — проверить, что закоммиченный индекс совпадает с результатом сборки; сеть не нужна.
- `npm run search:coverage` — показать заполненность и наиболее важные незаполненные папки.
- `npm run search:prepare` — последовательно выполнить sync, validate, build и coverage.

CI запускает validate и build check по закоммиченным данным и не обращается к API Яндекс.Диска. `search:sync` в CI не запускается.

## Индекс и будущая схема

`src/generated/search-index.json` — сгенерированный артефакт. **DO NOT EDIT GENERATED SEARCH INDEX MANUALLY.** Пересоберите его командой `npm run search:build` после правок таблиц.

При будущем переносе в Cloudflare D1 таблица объектов соответствует структуре:

```text
search_metadata
---------------
object_key, course_id, type, path, name,
aliases, keywords, priority, enabled, notes, source_status
```

Глобальные синонимы хранятся отдельно, например в `search_synonyms(term, synonyms, enabled, notes)`. D1 для поисковых метаданных сейчас не создаётся.

Production search пока остаётся прежним. Для будущего Search Engine Wiki фиксирует общий ranking: точное совпадение name → точный alias → начало name → начало alias → точный keyword → начало keyword → substring → transliteration → fuzzy typo match → manual priority. Коэффициенты должны быть централизованы в одном scoring engine. Live suggestions и full search должны использовать тот же индекс и тот же scoring engine; подсказка может показывать совпавшую тему, например «Кирхгоф» для папки «Электротехника».

Подробная инструкция по редактированию находится в [data/search/README.md](../data/search/README.md).
