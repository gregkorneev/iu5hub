# Telegram Mini App

## Integration rules

- Telegram Mini App — единственный поддерживаемый пользовательский runtime. Это не означает, что UI-компоненты могут обращаться к Telegram API напрямую.
- Определять и инициализировать Telegram WebApp один раз в централизованном integration layer. Он вызывает `ready()`, но не вызывает автоматически `expand()` или fullscreen API: режим отображения выбирает пользователь и Telegram-клиент.
- Поддерживаются Compact, Fullsize и Fullscreen. Один и тот же UI использует фактические viewport height и safe-area insets; переход между режимами не сбрасывает маршрут, форму поиска или состояние каталога.
- Integration layer применяет theme params, viewport/safe area и BackButton; он подписывается на `viewportChanged` (а при наличии — fullscreen/safe-area events) и обновляет CSS-переменные. Компонентам не разрешены прямые `window.Telegram.WebApp...` calls.
- React navigation и Telegram BackButton синхронизируются: BackButton показывается вне главной страницы и возвращает на предыдущий внутренний маршрут; если истории Mini App нет, он ведёт на главную. Поэтому возврат из вложенной папки курса идёт к предыдущему уровню, а не закрывает приложение или создаёт loop.
- Внешние ссылки на Яндекс.Диск проходят URL validation и открываются Telegram-compatible методом (`openLink`/подходящий API), выбранным внутри integration layer.
- Кнопки четырёх курсов и вложенных каталогов ведут только по внутренней React-навигации; внешний переход выполняется лишь для конечного файла или явного действия «открыть папку на Диске».
- Для узкого viewport курс, семестры и карточки перестраиваются в одну колонку; заголовок, навигация и safe areas сохраняют доступность без горизонтальной прокрутки.
- Поддерживаемые клиенты: Telegram iOS, Android, Desktop и Web. Локальный browser запуск допустим только для разработки и automated checks, не как продуктовый режим.
- Haptic — необязательное улучшение для явных пользовательских действий, без функциональной зависимости от него.

## Navigation invariant

`HashRouter`, список маршрутов и иерархия каталога (курс → семестр/папка → предмет → материал) остаются прежними. Единая плавающая нижняя панель служит верхнеуровневой навигацией Каталог / Поиск / Профиль для всех ролей. Подтверждённые администраторы дополнительно получают ссылку «Статистика» в правой части шапки; она не занимает tab bar. На маршрутах, где раньше показывались локальные кнопки «Назад» или «К корню курса», они входят в contextual row той же нижней glass-панели; обработчики `goBack` и ссылки курса не меняются. Панель остаётся видимой на корневых и вложенных страницах, включая Search results и footer; на неизвестном и недоступном admin route она не выбирает несуществующую вкладку.

### Route → tab mapping

Централизованное соответствие в `src/App.tsx` (helper `isCatalogRoute` и вычисление `activeNav`):

| Route | Navigation root / active tab | Bar and available tabs | Existing Back behavior |
| --- | --- | --- | --- |
| `/` | Catalog | Visible; Catalog + Search + Profile; Statistics link in header only for confirmed admins | Telegram BackButton hidden; no in-app Back |
| `/course/:id` and `?path=…` | Catalog; Search while opened from Search results/suggestions (`location.state.fromTab`) | Visible; same role-based set; Back in contextual row; course root link when `path` is non-empty | Contextual Back and Telegram BackButton call `goBack`; fallback to `/` when no in-app history |
| `/semester/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/subject/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/subject/:id/:category` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/material/:id` | Catalog | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/search?q=…` | Search | Visible; same role-based set; Back in contextual row | Contextual Back and Telegram BackButton call `goBack` |
| `/admin/stats` | No selected bottom tab; header Statistics link selected for confirmed admins | Visible; Catalog + Search + Profile; header Statistics link only for confirmed admins | Telegram BackButton uses `goBack`; AdminStats remains server-authorized |
| `/profile` | Profile | Visible; same role-based set; no contextual Back | Existing profile flow |
| `*` | No selected tab | Visible; Catalog + Search + Profile; header Statistics link only for confirmed admins | Contextual Back and Telegram BackButton use existing `goBack` fallback |

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

## Manual checks

Проверить iOS/Android/Desktop/Web Telegram: launch в Compact, Fullsize и доступном Fullscreen; theme (light/dark), viewport и safe areas, переходы между режимами без автоматического расширения или потери состояния, BackButton (в том числе переход «курс → подпапка → назад» и fallback на главную), внешнюю Yandex Disk ссылку, внутреннюю навигацию, long titles, empty/error states и slow-network поведение. На узком экране проверить одну колонку и отсутствие горизонтального скролла. В локальном browser проверять лишь безопасный developer fallback, не пользовательский Web mode.
