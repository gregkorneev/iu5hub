import { apiUrl, initDataHeaders } from './api'

export type AnalyticsEventType = 'search' | 'subject_open' | 'material_open' | 'yandex_disk_open'

const send = (path: string, body?: object) => {
  void fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...initDataHeaders() }, body: body ? JSON.stringify(body) : undefined, keepalive: true }).catch(() => undefined)
}

/** Telemetry is deliberately best-effort: it never delays a student action. */
export const trackAppOpen = () => send(apiUrl('/api/analytics/open'))
export const track = (type: AnalyticsEventType, ids: { subjectId?: string; materialId?: string } = {}) => send(apiUrl('/api/analytics/event'), { type, ...ids })
export const adminFetch = (path: string) => fetch(apiUrl(path), { headers: initDataHeaders() })
