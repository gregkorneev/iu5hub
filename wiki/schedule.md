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

## Выбор даты

Вместо переключателей «Сегодня / Неделя» экран сразу показывает горизонтальную ленту из семи последовательных дат: три дня до текущей даты в `Europe/Moscow`, текущая дата и три дня после. Сегодня изначально выбран и прокручен к центру ленты; выбор даты меняет расписание и учебную неделю, а сама семидневная граница остаётся привязанной к сегодняшнему дню. При смене календарного дня выбранная дата возвращается на новое «сегодня», если прежний выбор вышел из диапазона. `weekNumber` и наполнение расписания рассчитываются для выбранной даты; номер недели и числитель/знаменатель показаны рядом с названием выбранной группы. Лента прокручивается горизонтально, не создаёт вертикальный scrollbar; вертикальная прокрутка на расписании ограничена списком занятий.

## Обновление и восстановление

Обычный `npm run schedule:sync` до первого HTTP-запроса проверяет локальный `weekOneStart`. Workflow запускает проверку еженедельно в воскресенье в 17:00 UTC (20:00 Москвы); sync выполняется только перед новым числителем, то есть в 14-дневном цикле. `workflow_dispatch` принудительно синхронизирует вне графика. Начальную синхронизацию можно запустить `npm run schedule:sync -- --force`.

Синхронизация находит группы, скачивает API/ICS с concurrency 2, timeout 20 секунд и ограниченными retries, затем парсит, раскрывает recurrence и валидирует все файлы в staging. Набор публикуется только после успешной проверки всех групп через замену каталогов с восстановлением previous-known-good при сбое. HTTP/API/parser/validation failure не меняет production dataset. Если расписание не изменилось, сохраняются прежние timestamps: GitHub Actions не создаёт commit и Cloudflare Pages не получает новый deploy.

Изменение JSON создаёт bot commit в `main`; существующая GitHub integration Cloudflare Pages автоматически собирает `dist/` и публикует static assets. Отдельный static schedule workflow не использует Worker/D1 и не конкурирует с Cloudflare deploy workflow.

Команды: `npm run schedule:inspect` (живая проверка LKS), `npm run schedule:sync` (pipeline с локальным cycle gate), `npm run schedule:sync:check` (только локальный gate, без сети), `npm run schedule:validate` (проверка committed JSON без сети). Обычные CI/`npm run qa` используют только локальные fixtures и generated files.

## Подтверждённые ограничения

- Для части ИУ5 групп LKS пока не публикует календарь; UI показывает «Расписание пока не опубликовано».
- LKS отдаёт корректный calendar body с неправильным MIME и malformed ATTENDEE. Sync tolerates только подтверждённую ATTENDEE аномалию; другие parser errors останавливают обновление.
- Реальный Telegram WebView, экранная клавиатура и фактическая cross-device проверка двух учётных записей требуют запуска в Telegram; браузерные фикстуры подтверждают только локальное поведение.

## Telegram Schedule Widget (Bot API 10.4)

Schedule Widget is an additional private-chat view and does not replace `/#/schedule`. `/schedule` and the exact reply-keyboard text `📅 Расписание` use the verified Telegram webhook update's `from.id`, HMAC it with the environment's existing `USER_ID_HMAC_SECRET`, and read `profile_preferences.schedule_group_id` from that environment's `ANALYTICS_DB`. Beta never reads production preferences. The stored group must match the published `groups.json`; its static `groups/{groupId}.json` supplies all lesson, week and source-update data. The Worker derives the data and Mini App URLs from `ANALYTICS_ALLOWED_ORIGIN`, accepting only the two fixed origins `https://beta.iu5hub.pages.dev` and `https://iu5hub.pages.dev`; user data cannot choose a URL. It applies a three-second timeout and HTTP/schema validation. It never requests LKS at runtime.

The widget sends a current Moscow day snapshot in `chat_data`. Its immutable HTML calls `TelegramWidget.request()` only from explicit taps; today, tomorrow, week, day selection and additional lesson pages are returned directly via `answerWidgetQuery`, so switching views adds no chat message. The week is Monday–Sunday in `Europe/Moscow`; teaching week and numerator/denominator derive from the existing semester `weekOneStart`. Empty days and unavailable group schedules remain separate states. Long days are paged without shortening subject, teacher or room names.

If no group is selected or the saved group disappeared, the bot explains the state and opens the existing Beta schedule route for selection. It does not choose a default or automatically resend after a profile change. Data or Telegram failures produce one silent response after the explicit request and a manual retry path. Group chats are ignored. A short-lived D1 `telegram_update_receipts` table deduplicates repeated schedule message updates; the existing technical cleanup Cron removes old receipts. It is not a user notification mechanism.

The Beta Worker and private-chat Telegram bot are configured independently from production. Migration `0007_telegram_update_receipts.sql` is applied to Beta D1. The Beta Worker still has no `TELEGRAM_BOT_TOKEN` secret, so Beta bot deployment and live widget verification remain pending. Production is a separate release target with its own D1, Worker secrets, bot and Pages origin; never copy settings or private D1 data between the environments.
