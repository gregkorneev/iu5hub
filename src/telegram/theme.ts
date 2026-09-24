import { getTelegramWebApp } from './webapp'

const set = (name: string, value?: string) => value
  ? document.documentElement.style.setProperty(name, value)
  : document.documentElement.style.removeProperty(name)

export const applyTelegramTheme = () => {
  const app = getTelegramWebApp()
  const params = app?.themeParams
  document.documentElement.style.colorScheme = app?.colorScheme ?? ''
  if (app?.colorScheme) document.documentElement.dataset.telegramTheme = app.colorScheme
  else delete document.documentElement.dataset.telegramTheme
  set('--platform-background', params?.bg_color)
  set('--platform-text', params?.text_color)
  set('--telegram-secondary-background', params?.secondary_bg_color)
  set('--telegram-button-color', params?.button_color)
  set('--telegram-button-text-color', params?.button_text_color)
}
