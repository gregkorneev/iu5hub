# Нижняя навигация: Liquid Glass для WebView

Решение для нижней панели «Каталог», «Поиск», «Расписание», «Профиль». Реализация остаётся CSS-оформлением существующего `<nav>` и ссылок; `aria-current`, маршруты, hit targets и Telegram BackButton не участвуют в декоративной механике.

## Источники и лицензия

Изучены исходники Telegram-iOS на зафиксированной ревизии [`f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838`](https://github.com/TelegramMessenger/Telegram-iOS/tree/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838):

- [GlassBackgroundComponent.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/GlassBackgroundComponent/Sources/GlassBackgroundComponent.swift)
- [LegacyGlassView.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/GlassBackgroundComponent/Sources/LegacyGlassView.swift)
- [TouchEffect.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/GlassBackgroundComponent/Sources/TouchEffect.swift)
- [GlassBarButtonComponent.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/GlassBarButtonComponent/Sources/GlassBarButtonComponent.swift)
- [GlassControlPanel.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/GlassControls/Sources/GlassControlPanel.swift)
- [LiquidGlassShapesLayer.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/LiquidGlassShapes/Sources/LiquidGlassShapesLayer.swift) и [LiquidGlassBackdropLayers.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Components/LiquidGlassShapes/Sources/LiquidGlassBackdropLayers.swift) — только для понимания стоимости и поведения нативного рендеринга.

Официальная [страница приложений Telegram](https://telegram.org/apps) указывает для iOS GNU GPL v2 or later; в корне GitHub-репозитория на проверенной ревизии отдельный `LICENSE` не обнаружен. Из исходников взяты только общие инженерные идеи. Swift-код, шейдеры и графические ресурсы не копировались. UIKit, Core Animation и Metal API недоступны как CSS/JavaScript API в Telegram WebView.

## Применённые принципы

- **GlassBackgroundView / Container:** панель является одной общей стеклянной капсулой с нейтральным tint и одной областью backdrop blur. Геометрия материала отделена от интерактивного содержимого; четыре ссылки не получают собственные фильтруемые поверхности.
- **LegacyGlassView:** объём строится отдельными статическими компонентами — полупрозрачной базой, неодинаковыми светлыми краями, нижним затемнением, бликом и тенью — вместо усиления blur.
- **GlassBarButtonComponent:** активное состояние оформлено как отдельная движущаяся капсульная линза с прозрачным градиентом, внутренними кромками и отражением; содержимое ссылки остаётся неподвижным.
- **TouchEffect:** перемещение линзы использует короткий CSS transform transition с контролируемой easing-кривой. Нет JS spring, drag, дополнительного состояния или постоянно работающего цикла.
- **LiquidGlassShapes:** ресурсный нативный код не переносится. В покое CSS-материал статичен; во время прокрутки действует один общий умеренный blur.

## CSS-слои и токены

Все роли ограничены `.bottom-nav` в `src/design.css`:

1. Общая поверхность: `--nav-glass-fill`, `--nav-glass-edge`, `--nav-glass-shadow`; один `backdrop-filter: blur(16px) saturate(135%)` при поддержке.
2. Активная линза (`::before`): `--nav-lens-fill`, `--nav-lens-edge`; градиенты и внутренние светлые/тёмные кромки. У линзы нет собственного `backdrop-filter`.
3. Общий неподвижный верхний отражённый свет (`::after`). Оба псевдоэлемента имеют `pointer-events: none`, а ссылки находятся выше них по слою.
4. Контент — существующие `<a>` с `aria-current="page"`. Положение линзы по-прежнему рассчитывает `--nav-shift` через CSS `:has()`.

В светлой теме база светлая и полупрозрачная, кромка отделяет её на белом фоне. В тёмной теме tint нейтральнее и менее синий, с немного контрастнее кромкой. Эти CSS-токены не меняют общие `--material-*` и не применяют нативные alpha `.panel` напрямую.

## Совместимость и доступность

- `@supports (backdrop-filter: blur(1px))` включает умеренное размытие; отдельная проверка `-webkit-backdrop-filter` покрывает WebKit-вариант.
- При отсутствии backdrop blur поверхность становится плотнее, линза и навигация остаются видимыми.
- `prefers-reduced-transparency: reduce` убирает blur и повышает непрозрачность. `prefers-contrast: more` задаёт плотную поверхность, отчётливую границу и отдельную заливку активного состояния.
- `prefers-reduced-motion: reduce` отключает переход линзы. Масштабирование ссылок панели отключено, поэтому во время выбора не меняются их содержимое, размеры и hit targets.
- Псевдоэлементы не принимают события и не меняют семантику, фокус или прокрутку.

## Проверки и ограничения

Исходная Beta отвечала HTTP 200. До CSS-изменения исходный bottom navigation Playwright запускался параллельно и дал нестабильные ошибки соединения с Vite/WebKit и гонки закрытия trace-файлов; повторное последовательное измерение зафиксировало 7/7 Chromium UI cases. Одновременно исходная геометрия индикатора на 320px иногда выходила за границу активной ссылки примерно на 1 CSS px в момент измерения перехода; псевдоэлементу добавлен `box-sizing: border-box`.

До изменения исходный CSS задавал `--material-blur-regular: 20px` и saturation `150%`; после изменения навигация использует `blur(16px) saturate(135%)`. Надёжного pre-change браузерного performance capture не удалось сохранить: Playwright baseline запускался уже после начала CSS-правок, а ранний параллельный прогон столкнулся с Vite/WebKit/trace сбоями. Post-change headless Chromium RAF sample на Mac host, Chrome 153, 390×844, DPR 1 (5 × 1.2 сек) дал 72–73 callbacks на окно, p50 16.7ms, p95 16.7–16.8ms, max 16.8ms, без интервала свыше 50ms. RAF callback cadence не измеряет paint/compositing time и не подтверждает device FPS; сопоставимое A/B измерение производительности не заявляется. Реальный Telegram WebView iOS/Android требует ручного прогона.

Официальные скриншоты Liquid Glass от Apple/Telegram в рабочей среде не были доступны. WebView CSS не реализует нативную рефракцию, displacement и оптический рендеринг; эта реализация воспроизводит лишь принципы слоёв, отражений и движения.

См. результаты последнего запуска в [testing.md](testing.md), а общее оформление — в [design-system.md](design-system.md).
