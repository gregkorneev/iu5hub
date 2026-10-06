import { useEffect, useState } from 'react'
import { adminFetch } from './analytics'

type Period = 'today' | '7d' | '30d' | 'all'
type Summary = { users: { total: number; today: number; days7: number; days30: number }; launches: number; activity: { searches: number; materialOpens: number; yandexDiskOpens: number } }
type Activity = { days: Array<{ date: string; users: number; launches: number }> }
type Ranked = { items: Array<{ id: string; count: number }> }
type AnalyticsUser = { username: string | null; firstSeenAt: number; lastSeenAt: number; launchCount: number | null; userCount?: number }
type UsersPage = { items: AnalyticsUser[]; nextOffset: number | null }
type SortKey = 'username' | 'launchCount' | 'firstSeenAt' | 'lastSeenAt'
type SortDirection = 'asc' | 'desc'
type UserSort = { by: SortKey; direction: SortDirection }
const usersPageSize = 50
const periods: Array<[Period, string]> = [['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней'], ['all', 'Всё время']]
const periodUserMetric: Record<Period, { label: string; value: (users: Summary['users']) => number }> = {
  today: { label: 'Сегодня', value: (users) => users.today },
  '7d': { label: '7 дней', value: (users) => users.days7 },
  '30d': { label: '30 дней', value: (users) => users.days30 },
  all: { label: 'Всё время', value: (users) => users.total },
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="stats-card"><small>{label}</small><strong>{value.toLocaleString('ru-RU')}</strong></div> }
function Ranking({ title, entries, names }: { title: string; entries: Ranked['items']; names: Map<string, string> }) { return <section className="stats-section"><h2>{title}</h2>{entries.length ? <ol className="stats-ranking">{entries.map(({ id, count }) => <li key={id}><span title={names.get(id) ?? id}>{names.get(id) ?? id}</span><b>{count.toLocaleString('ru-RU')}</b></li>)}</ol> : <p className="lead">За выбранный период пока нет данных.</p>}</section> }

function formatUserDate(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const day = (value: Date) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(date)
  if (day(date) === day(today)) return `Сегодня, ${time}`
  if (day(date) === day(yesterday)) return `Вчера, ${time}`
  return day(date)
}

const userSortLabels: Record<SortKey, string> = { username: 'Пользователь', launchCount: 'Запуски', firstSeenAt: 'Первый вход', lastSeenAt: 'Последняя активность' }

function UserList({ page, onMore, loadingMore, sort, onSort }: {
  page: UsersPage
  onMore: () => void
  loadingMore: boolean
  sort: UserSort
  onSort: (key: SortKey) => void
}) {
  return <>
    <table className="stats-users-table" aria-label="Пользователи в статистике"><thead><tr>{(Object.keys(userSortLabels) as SortKey[]).map((key) => <th scope="col" key={key} aria-sort={sort.by === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" aria-label={`Сортировать: ${userSortLabels[key]}`} onClick={() => onSort(key)}><span className="stats-sort-label">{userSortLabels[key]}</span><span className={`stats-sort-indicator${sort.by === key ? ` is-${sort.direction}` : ''}`} aria-hidden="true"><span className="stats-sort-chevron stats-sort-chevron--up" /><span className="stats-sort-chevron stats-sort-chevron--down" /></span></button>
    </th>)}</tr></thead><tbody>
      {page.items.length ? page.items.map((user, index) => <tr key={`${user.firstSeenAt}-${index}`}>
        <td data-label="Пользователь"><strong>{user.username ? `@${user.username}` : user.userCount ? `Без username · ${user.userCount} пользователей` : 'Без username'}</strong></td>
        <td data-label="Запуски">{user.launchCount === null ? '—' : user.launchCount.toLocaleString('ru-RU')}</td>
        <td data-label="Первый вход">{formatUserDate(user.firstSeenAt)}</td>
        <td data-label="Последняя активность">{formatUserDate(user.lastSeenAt)}</td>
      </tr>) : <tr><td colSpan={4}><p className="lead">Пока нет пользователей с доступными данными. Username появится после следующего запуска Mini App.</p></td></tr>}
    </tbody></table>
    {page.nextOffset !== null && <button className="stats-users-more" type="button" onClick={onMore} disabled={loadingMore}>{loadingMore ? 'Загружаем…' : 'Показать ещё'}</button>}
  </>
}

function usersUrl(period: Period, username: string, sort: UserSort, offset: number) {
  const params = new URLSearchParams({ period, limit: String(usersPageSize), offset: String(offset) })
  if (username.trim()) params.set('username', username.trim())
  params.set('sortBy', sort.by)
  params.set('sortDirection', sort.direction)
  return `/api/admin/stats/users?${params}`
}

export function AdminStats({ names = new Map<string, string>() }: { names?: Map<string, string> }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<{ summary: Summary; activity: Activity; subjects: Ranked; materials: Ranked } | null>(null)
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ready'>('loading')
  const [usersPage, setUsersPage] = useState<UsersPage>({ items: [], nextOffset: null })
  const [usersState, setUsersState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [adminConfirmed, setAdminConfirmed] = useState(false)
  const [username, setUsername] = useState('')
  const [draftUsername, setDraftUsername] = useState('')
  const [sort, setSort] = useState<UserSort>({ by: 'lastSeenAt', direction: 'desc' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [usersMoreError, setUsersMoreError] = useState(false)
  const selectPeriod = (value: Period) => {
    setUsersPage({ items: [], nextOffset: null })
    setUsersState('loading')
    setUsersMoreError(false)
    setLoadingMore(false)
    setPeriod(value)
  }
  useEffect(() => {
    let active = true
    void adminFetch('/api/admin/me').then(async (me) => {
      if (!me.ok || !(await me.json() as { isAdmin?: boolean }).isAdmin) throw new Error('forbidden')
      if (active) setAdminConfirmed(true)
      return Promise.all(['summary', 'activity', 'subjects', 'materials'].map((part) => adminFetch(`/api/admin/stats/${part}?period=${period}`)))
    }).then(async (responses) => {
      if (responses.some((response) => response.status === 401 || response.status === 403)) throw new Error('forbidden')
      if (responses.some((response) => !response.ok)) throw new Error('error')
      return Promise.all(responses.map((response) => response.json())) as Promise<[Summary, Activity, Ranked, Ranked]>
    }).then(([summary, activity, subjects, materials]) => { if (active) { setData({ summary, activity, subjects, materials }); setState('ready') } }).catch((error: unknown) => { if (active) setState(error instanceof Error && error.message === 'forbidden' ? 'forbidden' : 'error') })
    return () => { active = false }
  }, [period])
  useEffect(() => {
    if (!adminConfirmed) return
    let active = true
    void adminFetch(usersUrl(period, username, sort, 0)).then(async (response) => {
      if (!response.ok) throw new Error('users')
      return response.json() as Promise<UsersPage>
    }).then((page) => { if (active) { setUsersPage(page); setUsersState('ready') } }).catch(() => { if (active) setUsersState('error') })
    return () => { active = false }
  }, [adminConfirmed, period, sort, username])
  const applyUsernameSearch = (value: string) => {
    setUsersPage({ items: [], nextOffset: null })
    setUsersState('loading')
    setUsersMoreError(false)
    setLoadingMore(false)
    setUsername(value)
  }
  const toggleSort = (key: SortKey) => {
    setUsersPage({ items: [], nextOffset: null })
    setUsersState('loading')
    setUsersMoreError(false)
    setLoadingMore(false)
    setSort((current) => ({ by: key, direction: current.by === key ? (current.direction === 'asc' ? 'desc' : 'asc') : (key === 'lastSeenAt' ? 'desc' : 'asc') }))
  }
  const loadMoreUsers = async () => {
    if (usersPage.nextOffset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await adminFetch(usersUrl(period, username, sort, usersPage.nextOffset))
      if (!response.ok) throw new Error('users')
      const nextPage = await response.json() as UsersPage
      setUsersPage((current) => ({ items: [...current.items, ...nextPage.items], nextOffset: nextPage.nextOffset }))
      setUsersMoreError(false)
    } catch {
      setUsersMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }
  if (state === 'loading') return <section className="stats-page" aria-busy="true"><h1>Статистика</h1><p className="lead">Загружаем приватную статистику…</p></section>
  if (state === 'forbidden') return <section className="stats-page"><h1>Статистика недоступна</h1><p className="lead" role="alert">Эта страница доступна только администраторам.</p></section>
  if (state === 'error' || !data) return <section className="stats-page"><h1>Статистика</h1><p className="lead" role="alert">Не удалось загрузить статистику. Попробуйте обновить страницу позже.</p></section>
  const max = Math.max(1, ...data.activity.days.flatMap((day) => [day.users, day.launches]))
  const periodMetric = periodUserMetric[period]
  return <section className="stats-page">
    <p className="eyebrow">Только для администратора</p><h1>Статистика</h1>
    <div className="stats-periods" aria-label="Период статистики">{periods.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => selectPeriod(value)}>{label}</button>)}</div>
    <div className="stats-grid"><Metric label="Всего" value={data.summary.users.total} /><Metric label={periodMetric.label} value={periodMetric.value(data.summary.users)} /></div>
    <details className="stats-section stats-users-disclosure" open>
      <summary><h2>Список пользователей</h2></summary>
      <form className="stats-users-search" onSubmit={(event) => { event.preventDefault(); applyUsernameSearch(draftUsername) }}>
        <label htmlFor="stats-username-search">Поиск по username</label>
        <input id="stats-username-search" type="search" value={draftUsername} placeholder="Например, ivanov" onChange={(event) => setDraftUsername(event.target.value)} />
        <button type="submit">Найти</button>
        <button type="button" onClick={() => { setDraftUsername(''); applyUsernameSearch('') }}>Сбросить</button>
      </form>
      {usersState === 'loading' ? <p className="lead" aria-busy="true">Загружаем список пользователей…</p> : usersState === 'error' ? <p className="lead" role="alert">Не удалось загрузить список пользователей. Попробуйте ещё раз позже.</p> : <><UserList page={usersPage} onMore={() => void loadMoreUsers()} loadingMore={loadingMore} sort={sort} onSort={toggleSort} />{usersMoreError && <p className="lead" role="alert">Не удалось загрузить следующую страницу. Попробуйте ещё раз.</p>}</>}
    </details>
    <section className="stats-section"><h2>Запуски и активность</h2><div className="stats-grid"><Metric label="Запуски" value={data.summary.launches} /><Metric label="Поиски" value={data.summary.activity.searches} /><Metric label="Открытия материалов" value={data.summary.activity.materialOpens} /><Metric label="Переходы на Яндекс.Диск" value={data.summary.activity.yandexDiskOpens} /></div></section>
    <section className="stats-section"><h2>Активность по дням</h2><div className="stats-chart" role="img" aria-label="График пользователей и запусков по дням">{data.activity.days.map((day) => <div className="stats-day" key={day.date} title={`${day.date}: ${day.users} пользователей, ${day.launches} запусков`}><i className="stats-bar stats-bar--users" style={{ height: `${(day.users / max) * 100}%` }} /><i className="stats-bar stats-bar--launches" style={{ height: `${(day.launches / max) * 100}%` }} /></div>)}</div></section>
    <Ranking title="Популярные предметы" entries={data.subjects.items} names={names} /><Ranking title="Популярные материалы" entries={data.materials.items} names={names} />
  </section>
}
