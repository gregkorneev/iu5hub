import { getTelegramWebApp } from './telegram/webapp'

const configuredApiBase = import.meta.env.VITE_ANALYTICS_API_BASE
const apiBase = (() => {
  if (!configuredApiBase) return ''
  try {
    const url = new URL(configuredApiBase)
    return url.protocol === 'https:' ? url.origin : ''
  } catch { return '' }
})()

export const apiUrl = (path: string) => `${apiBase}${path}`
export const initDataHeaders = (): Record<string, string> => {
  const initData = getTelegramWebApp()?.initData
  return initData ? { 'X-Telegram-Init-Data': initData } : {}
}
