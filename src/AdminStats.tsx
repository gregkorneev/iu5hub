import { useEffect, useState } from 'react'
import { adminFetch } from './analytics'

type Period = 'today' | '7d' | '30d' | 'all'
type Summary = { users: { total: number; today: number; days7: number; days30: number }; launches: number; activity: { searches: number; materialOpens: number; yandexDiskOpens: number } }
type Activity = { days: Array<{ date: string; users: number; launches: number }> }
type Ranked = { items: Array<{ id: string; count: number }> }
const periods: Array<[Period, string]> = [['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней'], ['all', 'Всё время']]

function Metric({ label, value }: { label: string; value: number }) { return <div className="stats-card"><small>{label}</small><strong>{value.toLocaleString('ru-RU')}</strong></div> }
function Ranking({ title, entries, names }: { title: string; entries: Ranked['items']; names: Map<string, string> }) { return <section className="stats-section"><h2>{title}</h2>{entries.length ? <ol className="stats-ranking">{entries.map(({ id, count }) => <li key={id}><span title={names.get(id) ?? id}>{names.get(id) ?? id}</span><b>{count.toLocaleString('ru-RU')}</b></li>)}</ol> : <p className="lead">За выбранный период пока нет данных.</p>}</section> }

export function AdminStats({ names = new Map<string, string>() }: { names?: Map<string, string> }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<{ summary: Summary; activity: Activity; subjects: Ranked; materials: Ranked } | null>(null)
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ready'>('loading')
  useEffect(() => {
    let active = true
    void adminFetch('/api/admin/me').then(async (me) => {
      if (!me.ok || !(await me.json() as { isAdmin?: boolean }).isAdmin) throw new Error('forbidden')
      return Promise.all(['summary', 'activity', 'subjects', 'materials'].map((part) => adminFetch(`/api/admin/stats/${part}?period=${period}`)))
    }).then(async (responses) => {
      if (responses.some((response) => response.status === 401 || response.status === 403)) throw new Error('forbidden')
      if (responses.some((response) => !response.ok)) throw new Error('error')
      return Promise.all(responses.map((response) => response.json())) as Promise<[Summary, Activity, Ranked, Ranked]>
    }).then(([summary, activity, subjects, materials]) => { if (active) { setData({ summary, activity, subjects, materials }); setState('ready') } }).catch((error: unknown) => { if (active) setState(error instanceof Error && error.message === 'forbidden' ? 'forbidden' : 'error') })
    return () => { active = false }
  }, [period])
  if (state === 'loading') return <section className="stats-page" aria-busy="true"><h1>Статистика</h1><p className="lead">Загружаем приватную статистику…</p></section>
  if (state === 'forbidden') return <section className="stats-page"><h1>Статистика недоступна</h1><p className="lead" role="alert">Эта страница доступна только администраторам.</p></section>
  if (state === 'error' || !data) return <section className="stats-page"><h1>Статистика</h1><p className="lead" role="alert">Не удалось загрузить статистику. Попробуйте обновить страницу позже.</p></section>
  const max = Math.max(1, ...data.activity.days.flatMap((day) => [day.users, day.launches]))
  return <section className="stats-page"><p className="eyebrow">Только для администратора</p><h1>Статистика</h1><div className="stats-periods" aria-label="Период статистики">{periods.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div><section className="stats-section"><h2>Пользователи</h2><div className="stats-grid"><Metric label="Всего" value={data.summary.users.total} /><Metric label="Сегодня" value={data.summary.users.today} /><Metric label="7 дней" value={data.summary.users.days7} /><Metric label="30 дней" value={data.summary.users.days30} /></div></section><section className="stats-section"><h2>Запуски и активность</h2><div className="stats-grid"><Metric label="Запуски" value={data.summary.launches} /><Metric label="Поиски" value={data.summary.activity.searches} /><Metric label="Открытия материалов" value={data.summary.activity.materialOpens} /><Metric label="Переходы на Яндекс.Диск" value={data.summary.activity.yandexDiskOpens} /></div></section><section className="stats-section"><h2>Активность по дням</h2><div className="stats-chart" role="img" aria-label="График пользователей и запусков по дням">{data.activity.days.map((day) => <div className="stats-day" key={day.date} title={`${day.date}: ${day.users} пользователей, ${day.launches} запусков`}><i className="stats-bar stats-bar--users" style={{ height: `${(day.users / max) * 100}%` }} /><i className="stats-bar stats-bar--launches" style={{ height: `${(day.launches / max) * 100}%` }} /></div>)}</div></section><Ranking title="Популярные предметы" entries={data.subjects.items} names={names} /><Ranking title="Популярные материалы" entries={data.materials.items} names={names} /></section>
}
