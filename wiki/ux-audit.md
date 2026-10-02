# UX-аудит «Студент ИУ5» — 27 сентября 2026

## Дополнение — 2 октября 2026

Повторная cross-browser проверка прошла: `npm run qa` завершился успешно; 222 Playwright-проверки прошли, две клавиатурные WebKit-проверки пропущены из-за поведения Tab на macOS-хосте. Добавлены desktop WebKit проверки и Linux CI Firefox. Реальный P2 дефект поиска исправлен: подсказки больше не исчезают при переходе фокуса с поля ввода на кнопку и результат. Дополнительно проверен production сайт в macOS Safari: главная, каталог, поиск и Telegram-only подсказка в профиле работают. Safari показал запрос разрешения на загрузку PDF, который был отклонён; поэтому сам файл не скачивался.

Остаточные ограничения: физические iOS/Android/iPad/Windows устройства, настоящее Telegram WebView, VoiceOver/TalkBack и remote device cloud недоступны в этой среде. Локальный Vite не предоставляет favorites API, поэтому реальную операцию сохранения нельзя проверить через локальный exploratory browser; mocked Playwright сценарии для сохранения, удаления и восстановления проходят. Полная матрица статусов и точное покрытие записаны в `testing.md` и `known-issues.md`.

| Platform | Device / browser | Test type | Result |
| --- | --- | --- | --- |
| macOS | Native Safari on this Mac | Production smoke | Home, Catalog, Search, and expected Telegram-only Profile guidance passed; PDF download stopped at the browser permission prompt. |
| Desktop browser | Playwright Chromium | Automated functional, route/history, responsive and axe smoke | 56/56 passed. |
| Mobile browser emulation | Playwright iPhone-sized Chromium viewport | Responsive, touch-oriented flows and navigation | 56/56 passed; viewport emulation, not a physical iPhone. |
| Mobile browser emulation | Playwright iPhone-sized WebKit viewport | Responsive and touch-oriented flows | 55 passed, 1 keyboard test skipped; WebKit engine emulation, not Mobile Safari or a physical device. |
| Desktop browser emulation | Playwright Desktop Safari WebKit project | Desktop functional/responsive flows | 55 passed, 1 keyboard test skipped; WebKit engine, not a native macOS Safari run. |
| iPadOS / tablet | 1024×768 and 1180×820 responsive viewports in Playwright | Layout checks | Tablet-width layout cases passed; no iPad or iPadOS Safari device was used. |
| Linux CI | Ubuntu GitHub Actions runner | Chromium, Firefox, WebKit | Firefox install/project added to CI; results await the post-push workflow. This is hosted Linux, not Windows. |
| Windows / Edge | No Windows device or browser available | Not run | Requires a Windows runner/device check. |
| Android / iOS devices and Telegram clients | No physical devices or signed-in Telegram WebView available | Not run | Requires real device smoke and signed-in account. |

**Automation:** rerun `npm run qa` for lint, typecheck, Vitest, Node/Worker, metadata/schedule validation, production build, and the full local Playwright project matrix. GitHub Actions `verify` runs Chromium, Firefox and WebKit on Ubuntu. Playwright retains failure screenshots, videos and traces under ignored `test-results/`; route, navigation, responsive geometry, error recovery, touch, reduced-motion and accessibility smoke remain repeatable. Visual screenshots are regression evidence rather than pixel-diff baselines.

**Issues:** one reproducible P2 keyboard defect was fixed: moving focus from Search input to its submit button closed suggestions before the result could be reached. Search focus now remains active within the search shell and resets after focus exits; native searchbox/button semantics are preserved. The unlabeled contextual action group is now a named navigation landmark, resolving the route axe `region` finding. No P0/P1 issue was found in the tested flows.

## Итог

**NEEDS WORK — Telegram device smoke before release.** В браузерных сценариях критических UX-препятствий и P0/P1 не найдено, безопасные недочёты исправлены и регрессии добавлены. Но приложение Telegram-only, а системный Back, клавиатура, внешний переход на материал и safe area настоящего Mini App на устройстве не проверялись — без короткой проверки в Telegram на iOS и Android выпуск нельзя уверенно сертифицировать. Также остаётся продуктовый предел: поиск находит размеченные папки по названиям предметов и преподавателям, но не произвольное имя файла.

## Пользователь и карта задач

Основной пользователь — студент ИУ5, которому нужно найти папку или файл курса, получить ссылку на него на Яндекс.Диске, быстро посмотреть расписание и при желании сохранить нужное в Избранное. Администратор использует те же четыре раздела и дополнительно открывает статистику из шапки.

| Цель | Путь | Успех / восстановление |
| --- | --- | --- |
| Найти файл через каталог | Запуск → Каталог → курс → семестр/папка → файл | Открыть файл; Back и Telegram Back возвращают на прежний уровень |
| Найти предмет через поиск | Поиск → название предмета/преподаватель → папка результата → файл | Результат показывает название и контекст курса/семестра; можно вернуться к запросу |
| Посмотреть расписание | Расписание → выбрать группу (первый раз) → дата | Уроки либо явное состояние «занятий нет»; группу можно сменить |
| Вернуться к сохранённому | Профиль → Избранное → папка/файл | Сохранение остаётся после перезагрузки; удалённый файл объясняется и доступен для удаления |
| Открыть админ-статистику | Шапка → Статистика → период | Только подтверждённый администратор; для студента прямой адрес закрыт |
| Открыть прямой адрес | Hash route → соответствующий экран | Вложенный экран загружается; неизвестный route объясняет, что страница не найдена |

### First-time и returning user

Новый пользователь получает краткое описание ценности на приветствии, затем три onboarding шага показывают Каталог, Поиск и Расписание с Избранным. Назначение каждого раздела bottom navigation ясно из короткой подписи. Поход за файлом понятен по карточкам курса/папки и действию «Скачать файл»; внешнее хранение дополнительно обозначено в footer. Первичная настройка расписания требует знать свою группу.

Постоянный пользователь быстро возвращается к недавнему месту через Back/Telegram Back и к запросу через Search tab; выбранная группа и избранное сохраняются. Частое открытие файла из избранного занимает один переход в Профиль и одно нажатие. В каталоге обычно нужны несколько уровней, что оправдано организацией учебных материалов; быстрый путь зависит от ручной поисковой разметки.

После первого запуска onboarding объясняет каталог, поиск предметов и преподавателей, расписание и профиль. Найти курс вручную обычно занимает 3–5 действий после входа в Каталог (выбрать курс, семестр, папку/предмет и файл); первый выбор группы — ещё ввод и выбор из списка, повторные открытия расписания требуют только перехода к вкладке. Поиск сокращает путь до папки, если студент знает название предмета или преподавателя.

## Область и способ проверки

Реальные маршруты: `/`, `/course/:id`, `/semester/:id`, `/subject/:id`, `/subject/:id/:category`, `/material/:id`, `/search`, `/schedule`, `/profile`, `/admin/stats`, wildcard 404. Пройдены студенческий и административный интерфейсы; welcome/повторный запуск; Каталог, Поиск, возврат между tabs и Telegram BackButton, Расписание с группой и пустым днём, Профиль/Избранное, недоступное сохранение и исчезнувший файл, direct link и отказ в статистике.

Основные автоматические сценарии используют Telegram и Яндекс fixtures, Chromium, mobile Chromium и WebKit. Покрытие включает узкие экраны 320 px, стандартные mobile layouts, landscape/tablet и empty/error/loading состояния в отдельных сценариях. Реальный first-time walkthrough выполнен в WebKit без предварительного чтения кода; отдельно проверены keyboard/focus semantics, роли и имена элементов.

**Граница достоверности:** эмуляция viewport не заменяет Telegram iOS/Android/Desktop, физическую клавиатуру iOS, смену окон Mini App на iPad, screen reader или реальный переход по внешней ссылке на устройстве. Админ и Telegram identity проверялись безопасными тестовыми ответами, а не настоящим аккаунтом. Перед релизом полезен короткий физический smoke test в Telegram на iOS и Android.

## Исправлено в рамках аудита

- Избранное больше не показывает сырой JSON/network error: при ошибке запроса отображается русская подсказка с повтором; ошибка 401 по-прежнему объясняет, что приложение нужно открыть через Telegram. Повторный запрос восстанавливает пустое состояние.
- Сообщение об ошибке избранного теперь помечено `role="alert"` и доступно для объявления screen reader.
- Карточки поиска показывают название и контекст папки без дополнительных пояснений. По возвращении к уже выполненному запросу поле остаётся сфокусированным, но повторные подсказки не перекрывают счётчик и результаты.
- Карточка Избранного на главной использует тот же контентный glass material, что и соседние карточки; reduced-transparency fallback сохраняется.

## Проблемы и рекомендации

| Priority | Flow | Наблюдение → проблема | Рекомендация |
| --- | --- | --- | --- |
| P2 · Medium | Поиск | Ищет предметные папки по альтернативным названиям и преподавателям, но не по произвольным названиям файлов; студент, который помнит имя PDF, может получить «Ничего не найдено» | После релиза решить, нужен ли индекс имён файлов и устойчивый полнотекстовый поиск. Сейчас область поиска объяснена в поле и на первом запуске. **Impact: Medium · Effort: Large** |
| P2 · Medium | Поиск / контекст | Пути результатов могут содержать исходные названия Яндекс.Диска на английском (`1 course / 1 Семестр`), хотя интерфейс русскоязычный | Отображать локализованные названия курса/семестра в подписи, сохраняя исходный Disk path только как источник маршрута. **Impact: Medium · Effort: Small** |
| P2 · Medium | Расписание / первичная настройка | Если группа ещё не выбрана, для получения пользы надо вручную вводить группу; пользователю важно знать её точное обозначение | Проверить на реальных первокурсниках, понятен ли пример `ИУ5-34Б`; при частой проблеме добавить подсказку, где найти обозначение группы. **Impact: Medium · Effort: Small** |

Это follow-up, не блокирует текущие основные сценарии: поиск ясно называет поддерживаемый тип запроса, а расписание объясняет выбор группы.

## Quick Wins

- Исправлены понятное сообщение и повтор запроса при ошибке избранного.
- Результаты поиска оставлены компактными: название и контекст папки курса/семестра.
- Исправлено повторное наложение подсказок на открытые результаты.
- Стеклянная поверхность домашней карточки Избранного унифицирована с соседними карточками.
- До релиза выполнить в реальном Telegram короткую проверку открытия файла и возврата, а также первичного выбора группы — небольшая ручная проверка с высоким эффектом уверенности.

## Post-release UX opportunities

- **P2 · Impact Medium · Effort Large:** исследовать поиск по названиям PDF и содержимому/метаданным материалов. Сейчас запрос должен совпасть с ручной разметкой; индексирование требует покрытия и правил обновления, поэтому это продуктовая задача.
- **P2 · Impact Medium · Effort Small–Medium:** локализовать в выдаче человекочитаемый контекст курса и семестра, не меняя точный путь к Яндекс.Диску.
- **P3 · Impact Medium · Effort Small:** проверить формулировку поиска и подсказку про учебную группу на интервью с несколькими студентами, которые впервые открывают Mini App.

## Критерии Apple и Telegram

Проверялись официальные принципы, а не пиксельный образец нативного интерфейса: [Apple HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) про top-level destinations; [Apple HIG — Searching](https://developer.apple.com/design/human-interface-guidelines/searching) про запросы и полезные подсказки; [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials) и [WWDC25 — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) про функциональный слой и читаемость; [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Telegram-specific BackButton, theme, safe area, `openLink` и изменяемый viewport сопоставлялись с [Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps).

## Релизная рекомендация

В браузерных сценариях P0/P1 не выявлены; автоматические регрессии покрывают исправленные состояния. **Перед выпуском** выполнить физическую проверку в Telegram на iOS и Android: выбрать группу, пройти вложенный каталог, вернуться через системный Back, открыть внешний материал и вернуться. Полнотекстовый поиск и локализация имён папок — продуктовые улучшения после релиза.
