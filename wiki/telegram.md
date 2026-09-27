# Telegram Mini App

## Integration rules

- Telegram Mini App — единственный поддерживаемый пользовательский runtime. Это не означает, что UI-компоненты могут обращаться к Telegram API напрямую.
- Централизованный Telegram startup flow вызывает `ready()`, затем `expand()` как максимум-height fallback и один раз запрашивает настоящий fullscreen через `requestFullscreen()` при наличии API (Bot API 8.0+, версия SDK проверена, `isFullscreen` ещё false). `fullscreenFailed` оставляет приложение в expanded fallback; повторного автоматического запроса после явного выхода пользователя нет.
- Fullscreen и expanded/full-height — разные состояния: `isExpanded` сообщает только о максимальной доступной высоте WebView; целевой fullscreen подтверждается `isFullscreen`. Проверенная официальная документация direct links описывает `mode=compact`, но не `mode=fullscreen`; не использовать последний как подтверждённый параметр.
- Integration layer применяет theme params, viewport, safe areas и BackButton; он подписывается на `viewportChanged`, `fullscreenChanged`, `fullscreenFailed`, `safeAreaChanged` и `contentSafeAreaChanged`, обновляет CSS-переменные/layout при каждом событии и живёт столько же, сколько документ Mini App (инициализируется один раз вне React mount cycle). `safeAreaInset` описывает экранные отступы, а `contentSafeAreaInset` — область, свободную от Telegram UI; для размещения app header/actions и нижней плавающей панели эффективный отступ выбирается как максимум двух значений, без сложения. Компонентам не разрешены прямые `window.Telegram.WebApp...` calls.
- Safe-area значения не фиксируются при первом рендере: ориентация, fullscreen и системная клавиатура могут изменить viewport. Верхний app header остаётся внутри content-safe-area и не имитирует Telegram controls; нижняя панель располагается над нижним content-safe-area/Home Indicator. CSS viewport units используются только для адаптации layout, не как замена Telegram fullscreen API.
- Вертикальные Telegram swipes остаются включёнными по умолчанию; `disableVerticalSwipes()` допустим только после подтверждённого конфликта с собственными gesture interactions. Fullscreen сам по себе не является причиной отключать системный жест.
- React navigation и Telegram BackButton синхронизируются: BackButton показывается вне главной страницы и возвращает на предыдущий внутренний маршрут; если истории Mini App нет, он ведёт на главную. Поэтому возврат из вложенной папки курса идёт к предыдущему уровню, а не закрывает приложение или создаёт loop.
- Внешние ссылки на Яндекс.Диск проходят URL validation и открываются Telegram-compatible методом (`openLink`/подходящий API), выбранным внутри integration layer.
- Кнопки четырёх курсов и вложенных каталогов ведут только по внутренней React-навигации; внешний переход выполняется лишь для конечного файла или явного действия «открыть папку на Диске».
- Для узкого viewport курс, семестры и карточки перестраиваются в одну колонку; заголовок, навигация и safe areas сохраняют доступность без горизонтальной прокрутки.
- Поддерживаемые клиенты: Telegram iOS, Android, Desktop и Web. Локальный browser запуск допустим только для разработки и automated checks, не как продуктовый режим.
- Haptic — необязательное улучшение для явных пользовательских действий, без функциональной зависимости от него.

## Navigation invariant

Current destinations are Каталог / Поиск / Расписание / Профиль for all roles, in that order. `/schedule` is a top-level route with no contextual Back button. Existing admin Statistics remains a separate server-confirmed header action. The same glass capsule already supports four links; «Расписание» is verified at 320/390/428 px with 44 px hit areas. The route is listed below with Catalog/Search/Profile mapping.

`HashRouter`, список маршрутов и иерархия каталога (курс → семестр/папка → предмет → материал) остаются прежними. Единая плавающая нижняя панель служит верхнеуровневой навигацией Каталог / Поиск / Расписание / Профиль для всех ролей. Подтверждённые администраторы дополнительно получают ссылку «Статистика» в правой части шапки; она не занимает tab bar. В нижнем contextual row остаётся только кнопка «Назад», использующая `goBack`; shortcut «К корню курса» удалён. Панель остаётся видимой на корневых и вложенных страницах, включая Search results и footer; на неизвестном и недоступном admin route она не выбирает несуществующую вкладку.

Логотип и текст «Студент ИУ5» в шапке — одна ссылка на `/`: касание любой её части возвращает на главную из каталога, расписания, поиска и профиля. При входе на главную `Layout` сбрасывает сохранённую вертикальную позицию документа до отрисовки; иначе после прокрученного каталога фиксированный Home может открыться с шапкой выше экрана. Сброс касается только маршрута `/`, не меняет историю, `goBack` или позицию других страниц. Browser regression проверяет обе зоны касания, вложенный каталог, Search result, все верхнеуровневые маршруты и вход через вкладку «Каталог» после прокрутки.

### Route → tab mapping

Централизованное соответствие в `src/App.tsx` (helper `isCatalogRoute` и вычисление `activeNav`):

| Route | Navigation root / active tab | Bar and available tabs | Existing Back behavior |
| --- | --- | --- | --- |
| `/` | Catalog | Visible; Catalog + Search + Schedule + Profile; Statistics link in header only for confirmed admins | Telegram BackButton hidden; no in-app Back |
| `/course/:id` and `?path=…` | Catalog; Search while opened from Search results/suggestions (`location.state.fromTab`) | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack`; fallback to `/` when no in-app history |
| `/semester/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/subject/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/subject/:id/:category` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/material/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/search?q=…` | Search | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/schedule` | Schedule | Visible; Catalog + Search + Schedule + Profile | Top-level destination; no contextual Back |
| `/admin/stats` | No selected bottom tab; header Statistics link selected for confirmed admins | Visible; Catalog + Search + Schedule + Profile; header Statistics link only for confirmed admins | Telegram BackButton uses `goBack`; AdminStats remains server-authorized |
| `/profile` | Profile | Visible; same role-based set; no contextual Back | Existing profile flow |
| `*` | No selected tab | Visible; Catalog + Search + Schedule + Profile; header Statistics link only for confirmed admins | Contextual Back and Telegram BackButton use existing `goBack` fallback |

The Search-to-course provenance keeps the Search tab selected while following an existing result/suggestion into its course folder and nested folders. The same URL opened directly or reloaded without that router state maps to Catalog, because the URL belongs to the catalog route. Search suggestions carry the search query URL in transient router state so returning to Search restores the query. Selecting Catalog always opens `/`; selecting Search restores its last query while the app stays mounted and focuses the search field, requesting the mobile keyboard. Selecting Search again while already on the Search page focuses the existing field directly. This uses no parallel navigation stack and does not change route destinations. Browser/Telegram Back remains the existing history-based `goBack`; tab selection and Back are separate controls.

### Apple guidance and web adaptation

Apple HIG defines tab bars as top-level navigation, says to keep them visible across sections, and calls out preserving each section’s navigation state. On iOS the bar floats above content on a Liquid Glass surface; the materials guidance distinguishes this functional layer from content. Apple documents minimizing on scroll as an explicit opt-in behavior, so this app keeps the bar expanded and available. Search is a supported dedicated tab pattern in multi-tab apps. Tab links remain links with `aria-current="page"` rather than implementing an ARIA tab widget, because they navigate to routes and preserve native link/keyboard behavior.

This is a web/Telegram adaptation: CSS `position: fixed`, `env(safe-area-inset-*)`, and Telegram viewport/safe-area CSS variables place the bar over the WebView; the app adds a bottom content reserve so the footer and final list items can scroll above it. It keeps a bottom placement at tablet/desktop sizes per the product requirement (Apple’s iPadOS-specific native placement can differ). There is no native `TabView` state restoration, scroll-edge system effect, software-keyboard safe-area integration, or system Liquid Glass refraction in WebView; those are not implied by the CSS treatment.

Official sources consulted and recorded for this decision:

- [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) — persistent top-level navigation and preserved section context.
- [Apple HIG: Navigation and search](https://developer.apple.com/design/human-interface-guidelines/navigation-and-search) and [Searching](https://developer.apple.com/design/human-interface-guidelines/searching) — search tab/page pattern.
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials) — navigation’s functional Liquid Glass layer over content.
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) — minimum 44×44 pt hit region and press feedback.
- [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) — navigation floats in the Liquid Glass layer, separated from content.
- [WWDC25: Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) and [Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/) — tab navigation keeps per-section context; bar minimization is configurable.
- [SwiftUI `TabView`](https://developer.apple.com/documentation/swiftui/tabview) and [`TabBarMinimizeBehavior`](https://developer.apple.com/documentation/swiftui/tabbarminimizebehavior) — official native API references; semantics inform but API is not copied into React.

## Security

`initData` и пользователь из client JavaScript недостоверны. Пока нет backend validation, использовать их только для оформления, языка и локальной UI-персонализации, не для прав, авторизации или хранения персональных данных. Если появится backend, он обязан валидировать `initData` server-side. OAuth-токен Яндекс.Диска никогда не передаётся в Mini App, не хранится в Vite-переменных и не попадает в URL/логи.

## Fullscreen launch audit

Реализация по централизованному startup должна приводить поддерживаемые клиенты к `isFullscreen === true`; для неподдерживаемого клиента сохраняется `expand()` fallback. Состояния события/геометрии проверяются отдельно: fake Telegram fixture может проверить вызовы API, feature/version gates, failure fallback и пересчёт inset/viewport, но не воспроизводит native window chrome, status bar, Dynamic Island, Home Indicator, клавиатуру или жесты.

| Entry point | Current launch configuration / evidence | Desired | Verification status |
| --- | --- | --- | --- |
| Bot profile «OPEN» / Main Mini App | Main Mini App задаётся в BotFather; публичный username/реальная конфигурация в репозитории не зафиксированы | Fullscreen через startup API | Требует запуска в Telegram iOS |
| Message button | Worker строит `web_app` кнопку «Открыть полную статистику» из `ADMIN_DASHBOARD_URL`; кнопка не является Main Mini App `startapp` link | Startup API запрашивает fullscreen; bot-generated URL проверяется на mode applicability | Требует проверить сообщение в Telegram iOS; локальный кодовый путь известен |
| Menu button | Настраивается в BotFather или Bot API, точное live значение вне репозитория | Startup API запрашивает fullscreen | Live конфигурация/устройство не проверены |
| Main Mini App direct link | В репозитории нет явного production `startapp` URL | Startup API запрашивает fullscreen. Официальная Web Apps документация показывает `mode=compact`, но не документирует `mode=fullscreen` | Требует URL/Telegram smoke |
| `startapp=<parameter>` deep link | В репозитории нет явного production startapp link | Сохранять start parameter; не добавлять недокументированный `mode=fullscreen` до подтверждения Telegram docs/client support | Требует URL/Telegram smoke |
| Admin/statistics link | Admin route `/admin/stats` и Worker message button; live admin link config не хранится в Git | Startup API; direct Main Mini App URL получает mode при применимости | Требует authorized iOS admin launch |

Официальная документация Web Apps описывает Main Mini App profile launch, menu/web_app launches, `requestFullscreen()` (Bot API 8.0+), `isFullscreen`, fullscreen/safe-area events и inset CSS variables. В разделе direct links документированы `startapp`, `startapp=<parameter>` и `mode=compact`; `mode=fullscreen` там не указан. Поэтому не заявлять и не генерировать `mode=fullscreen` как подтверждённый Telegram launch parameter, пока это не будет описано в официальной Web Apps документации. Документация также не описывает отдельную настройку BotFather для настоящего `requestFullscreen`; она позволяет задать Main Mini App и его launch height behavior, а true fullscreen запрашивается из Mini App через API. Описанный путь для Main Mini App: @BotFather → выбрать бота → настроить Main Mini App (точная вложенная навигация не приведена в Web Apps documentation). Для меню документирован путь `/setmenubutton` или Bot Settings → Menu Button. Не считать full-height по умолчанию эквивалентом fullscreen.

## Manual checks

Проверять iOS/Android/Desktop/Web Telegram по матрице выше: iOS — профиль OPEN, message button, Main Mini App direct link, admin/statistics, close/reopen; Android — fullscreen request, status/system navigation/back; Desktop — unsupported/failure fallback. На iPhone с Dynamic Island и notch, большом и малом viewport проверить safe-area края, header/actions, нижнюю навигацию, portrait/landscape и keyboard при Search. Проверить, что keyboard не центрирует нижнюю панель, scroll работает, а после закрытия геометрия восстанавливается. Локальный browser/Playwright годится для API mock, inset updates, responsive geometry, search keyboard/scroll и fallback branches, но не подтверждает настоящий fullscreen или native controls. Записывать каждую непроверенную физическим устройством строку в `known-issues.md`.
