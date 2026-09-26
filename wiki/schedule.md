# Встроенное расписание МГТУ

## Архитектура и источник

Расписание — статические JSON-файлы Cloudflare Pages. Mini App загружает `/data/schedule/groups.json` и `/data/schedule/groups/{groupId}.json`; браузер, Pages Worker и D1 не обращаются к LKS при открытии экрана.

Текущая публичная страница `https://lks.bmstu.ru/schedule/list` — SPA shell (HTTP 200, HTML). Реальное дерево групп находится в публичном `GET https://lks.bmstu.ru/lks-back/api/v1/structure`. Sync выбирает только узлы `nodeType=group` с названием `ИУ5-*`; в проверенном дереве 70 групп. Публичные метаданные каждой группы загружаются с `/lks-back/api/v1/schedules/groups/{UUID}/public`, календарь скачивается по ссылке `data.link`.

Для ИУ5-31Б подтверждено: UUID `bad1f09e-ed29-11ef-becd-8753117d52b2`; endpoint `https://lks.bmstu.ru/lks-back/srv/v2/ics/bad1f09e-ed29-11ef-becd-8753117d52b2`; HTTP 200, без redirect и без authentication/cookies. Тело содержит `BEGIN:VCALENDAR`, хотя сервер ошибочно указывает `Content-Type: text/html; charset=utf-8`; `Content-Disposition` отсутствует. Предполагаемый адрес `/schedule/{UUID}.ics` возвращает HTML и не используется.

Первый полный sync 2026-09-25 обнаружил 70 групп: 42 публичных календаря и 28 групп без опубликованного расписания (`204` или пустой список `schedule`). Отсутствие расписания является отдельным нормальным состоянием данных и UI.

## Формат и преобразование

Проверенный календарь ИУ5-31Б содержит 25 `VEVENT`: `UID`, `SUMMARY`, `DTSTAMP`, `DTSTART`, `DTEND`, `DESCRIPTION`, `LOCATION`, `ATTENDEE` и `RRULE`; 11 еженедельных и 14 двухнедельных series. `UNTIL` у проверенных правил — `20270105`; `INTERVAL=2` задаёт повтор той же числительной/знаменательной недели. `DTSTART` календаря дан в UTC, без `TZID`/`VTIMEZONE`: например `20260907T085000Z` — 11:50 в Москве. В этой выборке не встретились `EXDATE`, `RDATE`, `RECURRENCE-ID`, `COUNT`, `BYDAY` и `TZID`; расширение recurrence через ical.js покрывает их для будущих feeds и regression fixtures.

У LKS есть malformed `ATTENDEE;CN="Имя Фамилия"` без значения свойства. Sync добавляет фиктивный непубличный mailto value только для совместимого разбора ical.js; адрес не используется. Сопоставление преподавателя и типа занятия выполняется по публичному group schedule API, включая устранение неоднозначности одинаковых дисциплины, дня и времени по имени преподавателя/аудитории/типу занятия.

Pipeline разворачивает recurrence в календарные дни `Europe/Moscow`. Frontend получает время пар `HH:mm`, предмет, тип, преподавателя и аудиторию, не получает RRULE/EXDATE/TZID и не запрашивает LKS. Чередование недели выводится из маркеров LKS `ch` и `zn`, сопоставленных с `INTERVAL=2` series. Для текущего семестра установлен проверенный цикл `weekOneStart: 2026-08-31`; несовместимые назначения недели останавливают sync до замены прежних данных.

JSON содержит `group`, `source` (provider, UUID источника и время sync), `semester` (учебный год, term, weekOneStart), `availability` и `days`. Публичный `groups.json` предоставляет natural-sorted список и признак опубликованного расписания. UUID остаётся в статических технических метаданных, не отображается пользователю и не отправляется в аналитику.

## Выбор группы и приватность

`/#/schedule` — четвёртый верхнеуровневый route bottom navigation между Поиском и Профилем. Выбор группы доступен при первом запуске, в самом расписании и в отдельном блоке «Учебная группа» профиля.

Локальный fallback хранит только slug группы в localStorage. Для межустройственной синхронизации Worker предоставляет `GET/PUT /api/profile/schedule-group`; он проверяет Telegram `initData`, вычисляет стабильный HMAC владельца через `USER_ID_HMAC_SECRET` и сохраняет только slug и время изменения в `profile_preferences` (migration `0003_profile_preferences.sql`). Пользовательский Telegram ID, LKS UUID и данные расписания в D1 не хранятся. Schedule не генерирует analytics events и не передаёт group ID в `/api/analytics/*`.

## Недельный диапазон

В режиме «Неделя» отображается семь последовательных дат: три дня до текущей даты в `Europe/Moscow`, текущая дата и три дня после. Сегодня изначально выбран и прокручен к центру горизонтальной ленты; выбор другой даты не меняет границы диапазона. Возврат в режим «Сегодня» сбрасывает выбранную дату, поэтому при повторном открытии «Неделя» сегодняшняя дата снова активна и по центру. `weekNumber` и наполнение расписания по-прежнему рассчитываются для выбранной даты.

## Обновление и восстановление

Обычный `npm run schedule:sync` до первого HTTP-запроса проверяет локальный `weekOneStart`. Workflow запускает проверку еженедельно в воскресенье в 17:00 UTC (20:00 Москвы); sync выполняется только перед новым числителем, то есть в 14-дневном цикле. `workflow_dispatch` принудительно синхронизирует вне графика. Начальную синхронизацию можно запустить `npm run schedule:sync -- --force`.

Синхронизация находит группы, скачивает API/ICS с concurrency 2, timeout 20 секунд и ограниченными retries, затем парсит, раскрывает recurrence и валидирует все файлы в staging. Набор публикуется только после успешной проверки всех групп через замену каталогов с восстановлением previous-known-good при сбое. HTTP/API/parser/validation failure не меняет production dataset. Если расписание не изменилось, сохраняются прежние timestamps: GitHub Actions не создаёт commit и Cloudflare Pages не получает новый deploy.

Изменение JSON создаёт bot commit в `main`; существующая GitHub integration Cloudflare Pages автоматически собирает `dist/` и публикует static assets. Отдельный static schedule workflow не использует Worker/D1 и не конкурирует с Cloudflare deploy workflow.

Команды: `npm run schedule:inspect` (живая проверка LKS), `npm run schedule:sync` (pipeline с локальным cycle gate), `npm run schedule:sync:check` (только локальный gate, без сети), `npm run schedule:validate` (проверка committed JSON без сети). Обычные CI/`npm run qa` используют только локальные fixtures и generated files.

## Подтверждённые ограничения

- Для части ИУ5 групп LKS пока не публикует календарь; UI показывает «Расписание пока не опубликовано».
- LKS отдаёт корректный calendar body с неправильным MIME и malformed ATTENDEE. Sync tolerates только подтверждённую ATTENDEE аномалию; другие parser errors останавливают обновление.
- Реальный Telegram WebView, экранная клавиатура и фактическая cross-device проверка двух учётных записей требуют запуска в Telegram; браузерные фикстуры подтверждают только локальное поведение.
