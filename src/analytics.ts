import { getTelegramWebApp } from './telegram/webapp'

export type AnalyticsEventType = 'search' | 'subject_open' | 'material_open' | 'yandex_disk_open'

const configuredApiBase = import.meta.env.VITE_ANALYTICS_API_BASE
const apiBase = (() => {
  if (!configuredApiBase) return ''
  try {
    const url = new URL(configuredApiBase)
    return url.protocol === 'https:' ? url.origin : ''
  } catch { return '' }
})()
const api = (path: string) => `${apiBase}${path}`

const initDataHeaders = (): Record<string, string> => {
  const initData = getTelegramWebApp()?.initData
  return initData ? { 'X-Telegram-Init-Data': initData } : {}
}

const send = (path: string, body?: object) => {
  void fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...initDataHeaders() }, body: body ? JSON.stringify(body) : undefined, keepalive: true }).catch(() => undefined)
}

/** Telemetry is deliberately best-effort: it never delays a student action. */
export const trackAppOpen = () => send(api('/api/analytics/open'))
export const track = (type: AnalyticsEventType, ids: { subjectId?: string; materialId?: string } = {}) => send(api('/api/analytics/event'), { type, ...ids })
export const adminFetch = (path: string) => fetch(api(path), { headers: initDataHeaders() })
