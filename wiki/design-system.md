# Design System / Liquid Glass

Этот документ описывает визуальные роли Telegram Mini App «Студент ИУ5» по состоянию на 2026-09-25. Код в `src/design.css` и тесты остаются источником истины для конкретных значений. Приложение работает в Telegram WebView: его CSS-материалы **не являются** нативным Liquid Glass Apple с системной адаптацией, линзованием и рефракцией. Мы переносим принципы иерархии, геометрии, контраста и обратной связи, сохраняя собственную идентичность и Telegram theme.

## Принцип и слои

Apple описывает Liquid Glass как отдельный функциональный слой поверх контента и рекомендует применять его выборочно к навигации и важным controls; стекло внутри контента или поверх другого стекла размывает иерархию. Контентный слой опирается на стандартные материалы. В нашей веб-адаптации шапка, поиск, подсказки и ключевые действия могут использовать `backdrop-filter`; карточки курса, семестра, предмета, файла, статистики и деталей используют `--material-content` **без blur на каждой карточке**. Их полупрозрачная подложка — локальный контентный материал, а не претензия на системный Liquid Glass. Не добавлять второй стеклянный слой внутрь уже стеклянной поверхности. [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).

| Слой | Текущие роли | Правило |
| --- | --- | --- |
| Основа | `--surface-primary`, `--surface-secondary`, `--surface-elevated` | Цвета выводятся из Telegram `themeParams`; dark mode использует синие корпоративные поверхности. |
| Функциональный | `--material-thin`, `--material-regular`, `--material-thick`, `--action-glass` | Выборочный blur и полупрозрачность для шапки, поиска, подсказок, возврата и основных действий. Более важный или перекрывающий элемент визуально плотнее. |
| Контентный | `--material-content` | Карточки и аналитика получают светлый край и тень, но не отдельный blur. Текст и действие должны читаться на любой подложке. |
| Разделение | `--material-edge`, `--material-highlight`, `--material-shadow`, `--separator` | Граница, подсветка и тень обозначают уровень; не складывать их с тяжёлой рамкой на каждой карточке. |

Текущая доля `--surface-elevated` в полупрозрачных токенах: `thin` 58%/66%, `regular` 70%/76%, `thick` 84%/88%, `content` 60%/62% (light/dark). Эти числа описывают текущую CSS-реализацию; менять их можно только вместе с проверкой читаемости и иерархии в обеих темах.

Значения `thin/regular/thick` — **внутренние CSS-токены**, не варианты системного API Apple `regular/clear`. Их проценты прозрачности не являются рекомендацией Apple и проверяются вместе с реальным фоном. У Apple `clear` уместен только над богатым медиа-контентом при обеспеченной читаемости; текущий каталог не требует такого режима. [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).

## Токены и геометрия

- Цветовые роли: `--text-primary`, `--text-secondary`, `--action`, `--action-text` и `--separator`. `src/telegram/theme.ts` применяет Telegram `bg_color`, `text_color`, `secondary_bg_color`, `button_color`, `button_text_color` и `colorScheme`; системная тема ОС не должна переопределять выбранную тему Telegram.
- Отступы `--space-1…6` образуют шкалу 0.25–2 rem; геометрия `--radius-small`, `--radius-medium`, `--radius-large`, `--radius-pill` применяется по размеру и вложенности. Для вложенного контрола радиус должен выглядеть концентрично с родительской поверхностью после вычета внутреннего отступа; capsule используется для компактного самостоятельного действия, если подпись помещается. Это локальное применение принципа концентрической геометрии Apple. [WWDC25: Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/).
- Типографика: системный стек для основного текста, ALS Sector для бренда; `--type-hero`, `--type-screen`, `--type-section`, `--type-body`, `--type-meta` задают иерархию. Крупный заголовок имеет более плотный tracking, обычный текст — естественный. Размер текста, safe areas и touch target не подгоняются ради эффекта стекла.
- Шапка закреплена с `top: max(env(safe-area-inset-top), var(--tg-safe-area-top))`; верхняя зона закрывает прокручиваемый текст. `--tg-viewport-height` имеет CSS fallback `100dvh`, затем integration layer выставляет фактическую высоту Telegram. Материал не должен заслонять навигацию или поисковые подсказки.

## Доступность и fallback

- `prefers-reduced-transparency: reduce`: шапка, поиск, подсказки, controls и карточки переходят к непрозрачным семантическим поверхностям без blur. При отсутствии `backdrop-filter` базовые непрозрачные стили должны оставаться рабочими.
- `prefers-contrast: more`: непрозрачные поверхности, более явные границы и читаемый текст. Контраст текста и значков проверяется в light/dark, в том числе для цветных category tags; Apple рекомендует ориентиры WCAG AA 4.5:1 для обычного текста и 3:1 для крупного или жирного. [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple HIG: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode).
- `prefers-reduced-motion: reduce`: перемещение страницы заменяется коротким fade, а press feedback сохраняется без scale. Анимация не должна быть единственным сообщением о результате действия. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion).
- Browser fixture проверяет CSS и контраст, но фактический blur, клавиатура, safe area, status bar и тактильный отклик требуют ручной проверки в Telegram iOS/Android WebView. См. `known-issues.md`.

## Движение и навигация

Интерактивный элемент реагирует на `:active` сразу, сдержанным `scale(.985)` либо изменением opacity. Переходы маршрутов используют короткие transform/opacity и учитывают направление возврата; бесконечная декоративная анимация и bounce без пользовательского импульса не нужны. Apple связывает движение с причинностью, пространственной непрерывностью и комфортом пользователя. [WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/), [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

**Навигационный инвариант:** визуальная система не меняет `HashRouter`, существующие маршруты и иерархию каталога. Папка из поиска открывает внутренний каталог, файл использует прежний путь скачивания. Внутренняя кнопка и Telegram BackButton используют текущий `goBack`: предыдущий внутренний маршрут или главная при отсутствии истории. Tabs, sidebar, новый stack и swipe-жесты возврата не добавляются ради материала. Подробности: `telegram.md`.

## Проверка изменений

Перед выпуском проверить light/dark Telegram theme при несовпадении с темой ОС, короткий viewport с фокусом поиска, 320 px и длинные русские названия, прямую hash-ссылку, BackButton и in-app back, контраст/семантику, три accessibility preferences и отсутствие горизонтального overflow. Результаты последнего browser QA — в `testing.md`; real-device Telegram WebView остаётся отдельной ручной проверкой. [Apple: Testing system accessibility features](https://developer.apple.com/documentation/accessibility/testing-system-accessibility-features-in-your-app).
