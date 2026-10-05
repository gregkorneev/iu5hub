import { getTelegramWebApp } from './webapp'

const set = (name: string, value?: string) => value
  ? document.documentElement.style.setProperty(name, value)
  : document.documentElement.style.removeProperty(name)

export const applyTelegramTheme = () => {
  const app = getTelegramWebApp()
  const inTelegram = Boolean(app?.initData)
  const params = inTelegram ? app?.themeParams : undefined
  const colorScheme = inTelegram ? app?.colorScheme : undefined
  document.documentElement.style.colorScheme = colorScheme ?? ''
  const systemPrefersDark = !inTelegram && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  const headerColor = params?.bg_color ?? (colorScheme === 'dark' || (!inTelegram && systemPrefersDark) ? '#0d203a' : '#f6faff')
  if (inTelegram) app?.setHeaderColor?.(headerColor)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', headerColor)
  if (colorScheme) document.documentElement.dataset.telegramTheme = colorScheme
  else delete document.documentElement.dataset.telegramTheme
  set('--platform-background', params?.bg_color)
  set('--platform-text', params?.text_color)
  set('--telegram-secondary-background', params?.secondary_bg_color)
  set('--telegram-button-color', params?.button_color)
  set('--telegram-button-text-color', params?.button_text_color)
}
