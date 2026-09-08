import type { PlatformAdapter, TelegramWebApp } from './types'
import { isExternalHttpUrl } from './links'

const getTelegram = (): TelegramWebApp | undefined => (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp

export const telegramPlatform: PlatformAdapter = {
  type: 'telegram',
  openLink(url) { if (isExternalHttpUrl(url)) getTelegram()?.openLink(url) },
  close() { getTelegram()?.close() },
  haptic(type = 'light') {
    const feedback = getTelegram()?.HapticFeedback
    if (type === 'success') feedback?.notificationOccurred('success')
    else feedback?.impactOccurred(type)
  },
  getUser() {
    const user = getTelegram()?.initDataUnsafe?.user
    return user ? { id: String(user.id), firstName: user.first_name, username: user.username } : null
  },
}

export const initializeTelegram = () => {
  const telegram = getTelegram()
  if (!telegram) return
  telegram.ready()
  telegram.expand()
  const params = telegram.themeParams
  if (params?.bg_color) document.documentElement.style.setProperty('--platform-background', params.bg_color)
  if (params?.text_color) document.documentElement.style.setProperty('--platform-text', params.text_color)
  document.documentElement.dataset.platform = 'telegram'
}
