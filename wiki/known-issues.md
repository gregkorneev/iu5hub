# Known issues

| Status | Issue | Impact / resolution |
| --- | --- | --- |
| Resolved | В приложении оставалась старая иконка | Единственный общий asset `public/logo-iu5.jpeg` заменён на предоставленный знак «5»; это обновляет шапку на всех маршрутах. |
| Resolved | В landscape главная страница растягивалась, но не прокручивалась | Ограничение home viewport действует только в portrait; в landscape вертикальная прокрутка возвращена, горизонтальная остаётся запрещённой. Playwright проверяет этот сценарий. |
| Resolved | Кнопки скачивания в карточках файлов располагались на разной горизонтали | Общее правило `disk-item` больше не переопределяет fixed column у `disk-file`; Playwright сравнивает правые края кнопок короткого и длинного имени во всех browser engines. |
| Resolved | Главную страницу Mini App можно было прокручивать по вертикали и горизонтали | Для маршрута `/` контейнер фиксирован по фактической Telegram viewport height, а документ не создаёт scroll area; mobile Playwright regression проверяет обе оси. Каталог и поиск не ограничены. |
| Resolved | Hero на главной перехватывал касание ссылки «Статистика» | Шапка получила отдельный stacking layer; Playwright нажимает ссылку администратора на desktop, mobile Chromium и WebKit и ожидает защищённый dashboard. |
| Resolved | На iPhone подсказка поиска скрывалась под каталогом курсов | `hero` перестал обрезать overlay, а Playwright mobile regression проверяет, что центр подсказки является верхним tappable element. |
| Resolved | Латинский ввод (`Ma`) не давал подсказок для кириллических названий | Disk-поиск сопоставляет транслитерацию с именами на кириллице; Playwright mobile regression вводит `ma` и ожидает подсказку `Математический анализ`. |
| Open | Cloud.ru deployment not provisioned; Environment intentionally disabled | `cloudru-production` already exists with `CLOUDRU_DEPLOY_ENABLED=false`. Нужны dedicated bucket, Static Website Hosting with HTTPS plus index/error documents, secrets `CLOUDRU_ACCESS_KEY_ID`/`CLOUDRU_SECRET_ACCESS_KEY`/`CLOUDRU_BUCKET`, optional variable `CLOUDRU_PREFIX`, then reviewed enablement to `true`. До этого `deploy-cloudru` корректно пропускается. |
| Open | Первый Cloud.ru deploy и rollback ещё не проверены | Workflow делает destructive `aws s3 sync --delete` только внутри configured target/prefix, генерирует `error.html`, cache-ит `assets/` immutable и публикует `index.html` последним. До первой controlled deploy нельзя утверждать endpoint, cache headers или rollback. Нужны dedicated bucket/prefix и включённое versioning. |
| Open | Нет подтверждённого Telegram WebView launch | `@iu5_archive_bot` назначен только для local dev testing. Temporary Quick Tunnel URL можно задать вручную на одну сессию при доступе к bot settings, но конфигурация и реальный WebView test ещё не подтверждены. Bot token и URL не должны попадать в Git. |
| Open | Нет согласованного каталога Яндекс.Диска | Использовать demo data; заменить через repository/data source после появления ссылок. |
| Open (P3) | Обычный browser fallback может логировать Telegram SDK warning about unsupported BackButton version | Это не runtime exception и не влияет на fixture-based integration; real Telegram smoke remains the authority for SDK-version behavior. Browser tests should fail on exceptions and failed responses, not on this known SDK warning. |
# Поиск на Яндекс.Диске

Поиск рекурсивно обходит публичные папки Яндекс.Диска, углубляясь в совпавшую папку для поиска подходящего файла. Внешний API может быть медленным или недоступным, поэтому поиск ограничен общим дедлайном в 10 секунд и затем показывает пользователю ошибку. Это намеренная деградация: каталог и другие действия Mini App остаются доступными.
