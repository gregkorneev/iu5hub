import { getTelegramWebApp } from './webapp'

export const isExternalHttpUrl = (value: string): boolean => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

const yandexDiskHosts = new Set(['disk.yandex.ru', 'disk.yandex.com', 'yadi.sk'])

export const isYandexDiskUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && yandexDiskHosts.has(url.hostname)
  } catch { return false }
}

export const openExternalLink = (url: string) => {
  if (!isExternalHttpUrl(url)) return
  const app = getTelegramWebApp()
  if (app) {
    app.HapticFeedback?.impactOccurred('medium')
    app.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
