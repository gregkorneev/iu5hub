# Telegram Mini App

## Integration rules

- Определять Telegram runtime один раз в `TelegramPlatformAdapter`; browser получает `WebPlatformAdapter`.
- Адаптер применяет theme params, viewport/safe area и при необходимости BackButton; компонентам не разрешены прямые Telegram API calls.
- Внешние ссылки открываются методом адаптера; в Web используется безопасный браузерный путь.
- Haptic — необязательное улучшение для явных пользовательских действий, без функциональной зависимости от него.

## Security

`initData` и пользователь из client JavaScript недостоверны. Пока нет backend validation, использовать их только для оформления/UI, не для прав, авторизации или хранения персональных данных.

## Manual checks

Проверить Android/iOS/Desktop Telegram: тема, safe areas, кнопка назад, внешняя ссылка, deep link и отсутствие падения, когда Telegram API недоступен.
