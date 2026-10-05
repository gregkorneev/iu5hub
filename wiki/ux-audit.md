# UX-аудит «Студент ИУ5» — 27 сентября 2026

## Final release acceptance — 5 октября 2026

**Вердикт: PASS WITH KNOWN ISSUES.** На исправленной версии нет подтверждённых P0, P1 или оставшихся продуктовых P2 в проверенных сценариях. `npm run qa` завершился успешно: lint, typecheck, 30 Vitest, 54 Node/Worker, все search/tagging/schedule data checks, production build и Playwright — 254 passed / 2 host-specific WebKit keyboard skips. После этого отдельный responsive sweep проверил 118 сочетаний маршрута и ширины на Chromium и 118 на WebKit (16 точек от 320 до 1920 CSS px и landscape); горизонтального overflow не обнаружено.

### Подтверждённые findings

| ID | Priority / status | Platform, browser, viewport | Steps | Expected → actual | Evidence / root cause | Fix / regression |
| --- | --- | --- | --- | --- | --- | --- |
| A11Y-01 | P2 · Fixed | Production, dark system appearance, Chrome; first-run onboarding | Open Home in a fresh browser profile and scan «Далее» with axe-core 4.13 | ≥4.5:1 → 3.14:1 | Serious `color-contrast`; foreground/background `#001b36` / `#0066cf`; fallback action text inherited light-surface color under system dark mode. | Scoped system dark fallback token changes action label to white; axe regression in `welcome.spec.ts`. |
| A11Y-02 | P2 · Fixed | Production, dark theme, Catalog, 390×844 mobile viewport simulation; Chrome/axe | Open `/course/course-1`, let unauthenticated favorites request fail, scan «Повторить» | ≥4.5:1 → contrast failure on dark surface | Serious `color-contrast`; retry reused a dim `--action` color as text. The 401 is expected without Telegram `initData`; the guidance/retry UI itself was valid. | Retry uses high-contrast `--action-quiet`; tests cover system dark fallback and Telegram dark failed-save state. |
| A11Y-03 | P3 · Fixed | Production, invalid route `/#/bad-route`; desktop Chrome | Open an unknown hash route, inspect headings and recovery | A page-level h1 → only an h2 from generic EmptyState | axe `page-has-heading-one`; not-found reused the shared state component. Recovery path existed but heading hierarchy was incomplete. | Dedicated 404 section has h1 plus «На главную» link; Playwright h1 regression. |

No other confirmed P0/P1/P2 findings. Native desktop manual smoke used production on macOS Safari and Chrome: Home, Search, search suggestion/result, Catalog folder, in-app Back, browser Back, and keyboard focus. Native keyboard traversal on one macOS browser is not a screen-reader/AT certification. Production protected API calls return 401 when opened outside Telegram; the UI explains Telegram-only favorites and does not throw a client exception. Local Vite has no Worker, so its analytics 404s are expected fixture/environment gaps.

### Test matrix and limits

| Test environment | Engine/browser | Coverage | Result / classification |
| --- | --- | --- | --- |
| Native macOS desktop, production | Safari | Home → Search → result → Catalog, back, signed-out Profile message | Passed native desktop smoke. Large Mac display screenshot ~3024×1700; no smaller native window sweep or downloaded PDF. |
| Native macOS desktop, production | Google Chrome | Search `Физика`, suggestion/result, Catalog, breadcrumb focus | Passed native desktop smoke; same host, not Windows Chrome. |
| Local Playwright projects | Chromium desktop, Chromium with iPhone-sized touch/viewport emulation, WebKit with iPhone-sized emulation, WebKit desktop | Route/user/error paths, search, welcome, schedule, navigation, touch geometry, axe, responsive | 254 passed, 2 WebKit keyboard-only skips. Chromium/WebKit browser engines and CSS viewports; no physical mobile devices. |
| Local Playwright responsive sweep | Chromium and WebKit, 320/360/375/390/414/430/480/600/768/820/1024/1280/1366/1440/1600/1920 CSS px; landscape 844×390 | Home, course, semester, Search result, Schedule, Profile, 404 | 118 checks per engine; no horizontal overflow. This is viewport simulation. |
| Tablet-width emulation | Chromium/WebKit at 1024×768 and 1180×820 | Profile width and layout | Passed existing layout assertions; no iPadOS or iPad Safari device. |
| Windows 11 | Edge, Chrome, Firefox | Not available | Not run; no Windows host or Windows browser in this session. |
| iOS / Android / iPadOS | Mobile Safari / Chrome Android / Safari | Not available | No physical or cloud real-device service. Native keyboard, toolbar collapse, safe areas, Dynamic Island/notch, home indicator, Android system Back, rotation and touch feel are unverified. |
| Telegram Mini App | iOS, Android, Desktop | Not available | Test fixtures cover Telegram theme, safe-area and BackButton APIs; actual Telegram WebView/fullscreen/account flows remain device-only. |
| Screen reader / assistive tech | VoiceOver, TalkBack, Windows screen reader | Not available | Axe and accessibility tree checks are not AT sessions. |

The full current table and regression instructions are in `testing.md`; open platform requirements remain tracked in `known-issues.md` and `telegram.md`. No physical-device service/API key or Windows runner was connected, so that coverage remains a release follow-up rather than being described as passed.

## Дополнение — 2 октября 2026

Повторная cross-browser проверка прошла: локальный `npm run qa` завершился успешно; 226 Playwright-проверок прошли, две клавиатурные WebKit-проверки пропущены из-за поведения Tab на macOS-хосте. GitHub Actions run [37069107899](https://github.com/gregkorneev/iu5hub/actions/runs/37069107899) успешно выполнил 285 Playwright-проверок на Ubuntu с Chromium, Firefox и WebKit. Добавлены desktop WebKit проверки и Linux CI Firefox. Реальный P2 дефект поиска исправлен: подсказки больше не исчезают при переходе фокуса с поля ввода на кнопку и результат. Firefox также выявил P2 переполнение подписи «Расписание» в четырёхвкладочной панели на 320px; узкая панель теперь использует дополнительную безопасную ширину. Дополнительно проверен production сайт в macOS Safari: главная, каталог, поиск и Telegram-only подсказка в профиле работают. Safari показал запрос разрешения на загрузку PDF, который был отклонён; поэтому сам файл не скачивался.

Остаточные ограничения: физические iOS/Android/iPad/Windows устройства, настоящее Telegram WebView, VoiceOver/TalkBack и remote device cloud недоступны в этой среде. Локальный Vite не предоставляет favorites API, поэтому реальную операцию сохранения нельзя проверить через локальный exploratory browser; mocked Playwright сценарии для сохранения, удаления и восстановления проходят. Полная матрица статусов и точное покрытие записаны в `testing.md` и `known-issues.md`.

| Platform | Device / browser | Test type | Result |
| --- | --- | --- | --- |
| macOS | Native Safari on this Mac | Production smoke | Home, Catalog, Search, and expected Telegram-only Profile guidance passed; PDF download stopped at the browser permission prompt. |
| Desktop browser | Playwright Chromium | Automated functional, route/history, responsive and axe smoke | 57/57 passed. |
| Mobile browser emulation | Playwright iPhone-sized Chromium viewport | Responsive, touch-oriented flows and navigation | 57/57 passed; viewport emulation, not a physical iPhone. |
| Mobile browser emulation | Playwright iPhone-sized WebKit viewport | Responsive and touch-oriented flows | 56 passed, 1 keyboard test skipped; WebKit engine emulation, not Mobile Safari or a physical device. |
| Desktop browser emulation | Playwright Desktop Safari WebKit project | Desktop functional/responsive flows | 56 passed, 1 keyboard test skipped; WebKit engine, not a native macOS Safari run. |
| iPadOS / tablet | 1024×768 and 1180×820 responsive viewports in Playwright | Layout checks | Tablet-width layout cases passed; no iPad or iPadOS Safari device was used. |
| Linux CI | Ubuntu GitHub Actions runner | Chromium, Firefox, WebKit | GitHub Actions run 37069107899 passed 285/285 browser tests. This is hosted Linux, not Windows. |
| Windows / Edge | No Windows device or browser available | Not run | Requires a Windows runner/device check. |
| Android / iOS devices and Telegram clients | No physical devices or signed-in Telegram WebView available | Not run | Requires real device smoke and signed-in account. |

**Automation:** rerun `npm run qa` for lint, typecheck, Vitest, Node/Worker, metadata/schedule validation, production build, and the full local Playwright project matrix. GitHub Actions `verify` runs Chromium, Firefox and WebKit on Ubuntu. Playwright retains failure screenshots, videos and traces under ignored `test-results/`; route, navigation, responsive geometry, error recovery, touch, reduced-motion and accessibility smoke remain repeatable. Visual screenshots are regression evidence rather than pixel-diff baselines.

**Issues:** two P2 issues were fixed. Search previously closed suggestions when keyboard focus moved from its input to the submit button; focus now remains active within the search shell and resets after focus exits, retaining native searchbox/button semantics. Firefox exposed the «Расписание» label overflowing its navigation slot at 320px; below 380px the four-tab dock now uses more of the safe horizontal viewport, without reducing target height. The unlabeled contextual action group is now a named navigation landmark, resolving the route axe `region` finding. Linux CI passed Chromium, Firefox and WebKit (285/285). No P0/P1 issue was found in the tested flows.

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
