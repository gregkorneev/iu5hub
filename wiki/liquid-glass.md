# Нижняя навигация: Liquid Glass для WebView

## Liquid Glass 2.1 — Quiet Glass (2026-10-17)

The previous 2.0 CSS looked artificial because several independent high-contrast details competed at once: a bright radial lens hotspot, a split light/dark lens gradient, multiple inset highlights, a separate lens stroke and an additional upper reflection band. The 2.1 refinement removes that decoration instead of adding another material layer:

- The shared panel keeps one translucent fill, one low-contrast edge, one soft outside shadow and a single moderate backdrop filter (`blur(14px) saturate(120%)`).
- The active lens has no separate border or radial hotspot. It uses one low-contrast fill gradient, one faint top reflection and a minimal separation shadow. The existing 290ms transform transition and `--nav-shift` remain unchanged.
- The separate `.bottom-nav::after` shine band and stacked panel inset shadows are removed. Active label weight is reduced; icon tint and text contrast continue to identify the selected tab.
- Light and dark tokens are scoped to `.bottom-nav`; global materials are untouched. Reduced-transparency, increased-contrast, unsupported-backdrop, focus, reduced-motion and WebKit paths remain in place.

The independent UX review of matched captures found the silver arc, double outlines, harsh lens gradient and chrome impression removed; it requested softening the remaining bold active caption, which is included in the final CSS. Captures at `/tmp/iu5hub-glass-2.1-baseline/` and `/tmp/iu5hub-glass-2.1-after/` are not tracked in Git. Headless RAF callback cadence was unchanged before/after under the same conditions (p50 16.7ms, p95 16.7–16.8ms, max 16.7–16.8ms, no intervals >50ms), but this does not measure paint/compositing, dropped rendered frames or device FPS. The application layout reserves clearance above the fixed panel in the standard sampled routes, so only a narrow natural content edge appears under the compact Schedule case. Actual Telegram WebView/iOS/Android rendering remains a manual device check.

This is a CSS approximation of selected material and grouping principles, not Apple's system Liquid Glass renderer. No native API, copied Telegram code, visual assets or shader implementation is used.

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
- **LegacyGlassView:** общий принцип нескольких материальных составляющих адаптирован без буквального переноса всех контуров и отражений; текущий вариант использует очень слабое отражение и тень.
- **GlassBarButtonComponent:** активное состояние оформлено общей с панелью движущейся полупрозрачной линзой; содержимое ссылки остаётся неподвижным.
- **TouchEffect:** перемещение линзы использует короткий CSS transform transition с контролируемой easing-кривой. Нет JS spring, drag, дополнительного состояния или постоянно работающего цикла.
- **LiquidGlassShapes:** ресурсный нативный код не переносится. В покое CSS-материал статичен; во время прокрутки действует один общий умеренный blur.

## CSS-слои и токены

Все роли ограничены `.bottom-nav` в `src/design.css`:

1. Общая поверхность: `--nav-glass-fill`, `--nav-glass-edge`, `--nav-glass-shadow`; один `backdrop-filter: blur(14px) saturate(120%)` при поддержке.
2. Активная линза (`::before`): `--nav-lens-fill`, `--nav-lens-highlight`; слабый градиент и один малоконтрастный верхний отблеск. У линзы нет собственной границы или `backdrop-filter`.
3. Дополнительного `::after` блика нет. `::before` имеет `pointer-events: none`, а ссылки находятся выше него по слою.
4. Контент — существующие `<a>` с `aria-current="page"`. Положение линзы по-прежнему рассчитывает `--nav-shift` через CSS `:has()`.

В светлой теме база светлая и полупрозрачная, кромка отделяет её на белом фоне без яркой внутренней засветки. В тёмной теме tint нейтральный и слегка холодный, кромка малоконтрастна. Эти CSS-токены не меняют общие `--material-*` и не применяют нативные alpha `.panel` напрямую.

## Совместимость и доступность

- `@supports (backdrop-filter: blur(1px))` включает умеренное размытие; отдельная проверка `-webkit-backdrop-filter` покрывает WebKit-вариант.
- При отсутствии backdrop blur поверхность становится плотнее, линза и навигация остаются видимыми.
- `prefers-reduced-transparency: reduce` убирает blur и повышает непрозрачность. `prefers-contrast: more` задаёт плотную поверхность, отчётливую границу и отдельную заливку активного состояния.
- `prefers-reduced-motion: reduce` отключает переход линзы. Масштабирование ссылок панели отключено, поэтому во время выбора не меняются их содержимое, размеры и hit targets.
- Псевдоэлементы не принимают события и не меняют семантику, фокус или прокрутку.

## Проверки и ограничения

Исходная Beta отвечала HTTP 200. До 2.0 CSS-изменения индикатор на 320px иногда выходил за границу активной ссылки примерно на 1 CSS px во время перехода; у псевдоэлемента сохранён `box-sizing: border-box`.

В 2.0 Beta использовала `blur(16px) saturate(135%)`; эта версия сняла слишком контрастную линзу и снизила фильтр до `blur(14px) saturate(120%)`. Headless Chromium RAF samples до/после 2.1 при одинаковом host/browser, viewport и последовательности переключения дали одинаковые 72–73 интервала за окно, p50 16.7ms, p95 16.7–16.8ms, max 16.7–16.8ms, без интервала свыше 50ms. RAF callback cadence не измеряет paint/compositing time и не подтверждает device FPS. Реальный Telegram WebView iOS/Android требует ручного прогона.

Официальные скриншоты Liquid Glass от Apple/Telegram в рабочей среде не были доступны. WebView CSS не реализует нативную рефракцию, displacement и оптический рендеринг; эта реализация воспроизводит лишь принципы слоёв, отражений и движения.

См. результаты последнего запуска в [testing.md](testing.md), а общее оформление — в [design-system.md](design-system.md).
