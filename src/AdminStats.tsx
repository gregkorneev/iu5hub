import { useEffect, useState } from 'react'
import { adminFetch } from './analytics'

type Period = 'today' | '7d' | '30d' | 'all'
type Summary = { users: { total: number; today: number; days7: number; days30: number }; launches: number; activity: { searches: number; materialOpens: number; yandexDiskOpens: number } }
type Activity = { days: Array<{ date: string; users: number; launches: number }> }
type Ranked = { items: Array<{ id: string; count: number }> }
type AnalyticsUser = { username: string | null; firstSeenAt: number; lastSeenAt: number; launchCount: number }
type UsersPage = { items: AnalyticsUser[]; nextOffset: number | null }
type FilterKey = 'username' | 'minLaunchCount' | 'firstSeenOn' | 'lastSeenOn'
type UserFilters = Record<FilterKey, string>
const emptyFilters: UserFilters = { username: '', minLaunchCount: '', firstSeenOn: '', lastSeenOn: '' }
const usersPageSize = 50
const periods: Array<[Period, string]> = [['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней'], ['all', 'Всё время']]

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

const userFilterLabels: Record<FilterKey, string> = { username: 'Пользователь', minLaunchCount: 'Запуски', firstSeenOn: 'Первый вход', lastSeenOn: 'Последняя активность' }

function UserList({ page, onMore, loadingMore, filters, activeFilter, draftValue, onToggleFilter, onDraftChange, onApplyFilter, onClearFilter }: {
  page: UsersPage
  onMore: () => void
  loadingMore: boolean
  filters: UserFilters
  activeFilter: FilterKey | null
  draftValue: string
  onToggleFilter: (key: FilterKey) => void
  onDraftChange: (value: string) => void
  onApplyFilter: () => void
  onClearFilter: () => void
}) {
  return <>
    <table className="stats-users-table" aria-label="Пользователи в статистике"><thead><tr>{(Object.keys(userFilterLabels) as FilterKey[]).map((key) => <th scope="col" key={key}>
      <button type="button" aria-label={`Фильтр: ${userFilterLabels[key]}`} aria-expanded={activeFilter === key} className={filters[key] ? 'filtered' : ''} onClick={() => onToggleFilter(key)}>{userFilterLabels[key]}<span aria-hidden="true">{filters[key] ? '⌕' : '⌄'}</span></button>
    </th>)}</tr></thead><tbody>
      {activeFilter && <tr className="stats-users-filter-row"><td colSpan={4}><form onSubmit={(event) => { event.preventDefault(); onApplyFilter() }}>
        <label htmlFor="stats-user-column-filter">Фильтр: {userFilterLabels[activeFilter]}</label>
        <input id="stats-user-column-filter" autoFocus type={activeFilter === 'username' ? 'search' : activeFilter === 'minLaunchCount' ? 'number' : 'date'} min={activeFilter === 'minLaunchCount' ? '0' : undefined} step={activeFilter === 'minLaunchCount' ? '1' : undefined} value={draftValue} onChange={(event) => onDraftChange(event.target.value)} />
        <button type="submit">Применить</button><button type="button" onClick={onClearFilter}>Сбросить</button>
      </form></td></tr>}
      {page.items.length ? page.items.map((user, index) => <tr key={`${user.firstSeenAt}-${index}`}>
        <td data-label="Пользователь"><strong>{user.username ? `@${user.username}` : 'Без username'}</strong></td>
        <td data-label="Запуски">{user.launchCount.toLocaleString('ru-RU')}</td>
        <td data-label="Первый вход">{formatUserDate(user.firstSeenAt)}</td>
        <td data-label="Последняя активность">{formatUserDate(user.lastSeenAt)}</td>
      </tr>) : <tr><td colSpan={4}><p className="lead">Пока нет пользователей с доступными данными. Username появится после следующего запуска Mini App.</p></td></tr>}
    </tbody></table>
    {page.nextOffset !== null && <button className="stats-users-more" type="button" onClick={onMore} disabled={loadingMore}>{loadingMore ? 'Загружаем…' : 'Показать ещё'}</button>}
  </>
}

function usersUrl(period: Period, filters: UserFilters, offset: number) {
  const params = new URLSearchParams({ period, limit: String(usersPageSize), offset: String(offset) })
  if (filters.username.trim()) params.set('username', filters.username.trim())
  if (filters.minLaunchCount) params.set('minLaunchCount', filters.minLaunchCount)
  if (filters.firstSeenOn) params.set('firstSeenOn', filters.firstSeenOn)
  if (filters.lastSeenOn) params.set('lastSeenOn', filters.lastSeenOn)
  return `/api/admin/stats/users?${params}`
}

export function AdminStats({ names = new Map<string, string>() }: { names?: Map<string, string> }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<{ summary: Summary; activity: Activity; subjects: Ranked; materials: Ranked } | null>(null)
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ready'>('loading')
  const [usersPage, setUsersPage] = useState<UsersPage>({ items: [], nextOffset: null })
  const [usersState, setUsersState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [adminConfirmed, setAdminConfirmed] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<UserFilters>(emptyFilters)
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null)
  const [draftFilterValue, setDraftFilterValue] = useState('')
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
    void adminFetch(usersUrl(period, appliedFilters, 0)).then(async (response) => {
      if (!response.ok) throw new Error('users')
      return response.json() as Promise<UsersPage>
    }).then((page) => { if (active) { setUsersPage(page); setUsersState('ready') } }).catch(() => { if (active) setUsersState('error') })
    return () => { active = false }
  }, [adminConfirmed, appliedFilters, period])
  const applyUserFilters = (filters: UserFilters) => {
    setUsersPage({ items: [], nextOffset: null })
    setUsersState('loading')
    setUsersMoreError(false)
    setLoadingMore(false)
    setAppliedFilters(filters)
  }
  const toggleUserFilter = (key: FilterKey) => {
    if (activeFilter === key) { setActiveFilter(null); return }
    setDraftFilterValue(appliedFilters[key])
    setActiveFilter(key)
  }
  const applyActiveFilter = () => {
    if (!activeFilter) return
    applyUserFilters({ ...appliedFilters, [activeFilter]: draftFilterValue })
    setActiveFilter(null)
  }
  const clearActiveFilter = () => {
    if (!activeFilter) return
    applyUserFilters({ ...appliedFilters, [activeFilter]: '' })
    setDraftFilterValue('')
    setActiveFilter(null)
  }
  const loadMoreUsers = async () => {
    if (usersPage.nextOffset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await adminFetch(usersUrl(period, appliedFilters, usersPage.nextOffset))
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
  return <section className="stats-page">
    <p className="eyebrow">Только для администратора</p><h1>Статистика</h1>
    <div className="stats-periods" aria-label="Период статистики">{periods.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => selectPeriod(value)}>{label}</button>)}</div>
    <div className="stats-grid"><Metric label="Всего" value={data.summary.users.total} /><Metric label="Сегодня" value={data.summary.users.today} /><Metric label="7 дней" value={data.summary.users.days7} /><Metric label="30 дней" value={data.summary.users.days30} /></div>
    <details className="stats-section stats-users-disclosure" open>
      <summary><h2>Список пользователей</h2><span className="stats-users-toggle">Нажмите, чтобы скрыть или показать</span></summary>
      <p className="stats-users-privacy">Username виден только администратору и обновляется при запуске Mini App. Telegram ID и имя не сохраняются.</p>
      {usersState === 'loading' ? <p className="lead" aria-busy="true">Загружаем список пользователей…</p> : usersState === 'error' ? <p className="lead" role="alert">Не удалось загрузить список пользователей. Попробуйте ещё раз позже.</p> : <><UserList page={usersPage} onMore={() => void loadMoreUsers()} loadingMore={loadingMore} filters={appliedFilters} activeFilter={activeFilter} draftValue={draftFilterValue} onToggleFilter={toggleUserFilter} onDraftChange={setDraftFilterValue} onApplyFilter={applyActiveFilter} onClearFilter={clearActiveFilter} />{usersMoreError && <p className="lead" role="alert">Не удалось загрузить следующую страницу. Попробуйте ещё раз.</p>}</>}
    </details>
    <section className="stats-section"><h2>Запуски и активность</h2><div className="stats-grid"><Metric label="Запуски" value={data.summary.launches} /><Metric label="Поиски" value={data.summary.activity.searches} /><Metric label="Открытия материалов" value={data.summary.activity.materialOpens} /><Metric label="Переходы на Яндекс.Диск" value={data.summary.activity.yandexDiskOpens} /></div></section>
    <section className="stats-section"><h2>Активность по дням</h2><div className="stats-chart" role="img" aria-label="График пользователей и запусков по дням">{data.activity.days.map((day) => <div className="stats-day" key={day.date} title={`${day.date}: ${day.users} пользователей, ${day.launches} запусков`}><i className="stats-bar stats-bar--users" style={{ height: `${(day.users / max) * 100}%` }} /><i className="stats-bar stats-bar--launches" style={{ height: `${(day.launches / max) * 100}%` }} /></div>)}</div></section>
    <Ranking title="Популярные предметы" entries={data.subjects.items} names={names} /><Ranking title="Популярные материалы" entries={data.materials.items} names={names} />
  </section>
}
