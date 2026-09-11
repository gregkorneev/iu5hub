import { getTelegramWebApp } from './webapp'

const set = (name: string, value?: string) => value && document.documentElement.style.setProperty(name, value)

export const applyTelegramTheme = () => {
  const params = getTelegramWebApp()?.themeParams
  set('--platform-background', params?.bg_color)
  set('--platform-text', params?.text_color)
  set('--telegram-secondary-background', params?.secondary_bg_color)
  set('--telegram-button-color', params?.button_color)
}
