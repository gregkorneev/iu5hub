# Telegram Mini App

## Integration rules

- Telegram Mini App — единственный поддерживаемый пользовательский runtime. Это не означает, что UI-компоненты могут обращаться к Telegram API напрямую.
- Определять и инициализировать Telegram WebApp один раз в централизованном integration layer. Он вызывает `ready()` и, когда это улучшает mobile UX, `expand()`.
- Integration layer применяет theme params, viewport/safe area и BackButton; компонентам не разрешены прямые `window.Telegram.WebApp...` calls.
- React navigation и Telegram BackButton синхронизируются: возврат с материала ведёт к предмету, а не создаёт loop или конфликтующую историю.
- Внешние ссылки на Яндекс.Диск проходят URL validation и открываются Telegram-compatible методом (`openLink`/подходящий API), выбранным внутри integration layer.
- Поддерживаемые клиенты: Telegram iOS, Android, Desktop и Web. Локальный browser запуск допустим только для разработки и automated checks, не как продуктовый режим.
- Haptic — необязательное улучшение для явных пользовательских действий, без функциональной зависимости от него.

## Security

`initData` и пользователь из client JavaScript недостоверны. Пока нет backend validation, использовать их только для оформления, языка и локальной UI-персонализации, не для прав, авторизации или хранения персональных данных. Если появится backend, он обязан валидировать `initData` server-side.

## Manual checks

Проверить iOS/Android/Desktop/Web Telegram: launch, theme (light/dark), viewport и safe areas, BackButton, внешнюю Yandex Disk ссылку, внутреннюю навигацию, long titles, empty/error states и slow-network поведение. В локальном browser проверять лишь безопасный developer fallback, не пользовательский Web mode.
