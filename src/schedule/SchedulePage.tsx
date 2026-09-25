import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl, initDataHeaders } from '../api'
import './schedule.css'

type Group = { id: string; name: string }
type Lesson = { start: string; end: string; subject: string; type?: string; teacher?: string; location?: string }
type Schedule = { group: Group; source: { provider: string; syncedAt: string; sourceId: string }; semester: { academicYear: string; term: string | number; weekOneStart: string }; availability?: 'available' | 'no-schedule'; days: Record<string, Lesson[]> }
const storageKey = 'iu5hub.schedule.group'
const dateInMoscow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const addDays = (date: string, amount: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10) }
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
const shortDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))

function useScheduleGroup() {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState(() => localStorage.getItem(storageKey) || '')
  const [syncNotice, setSyncNotice] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(true)
  const changedByUser = useRef(false)
  useEffect(() => {
    let active = true
    void fetch('/data/schedule/groups.json').then((response) => { if (!response.ok) throw new Error(); return response.json() }).then((data: { groups: Group[] }) => { if (active) setGroups(data.groups) }).catch(() => { if (active) setSyncNotice('Не удалось загрузить список групп.') }).finally(() => { if (active) setLoadingGroups(false) })
    void fetch(apiUrl('/api/profile/schedule-group'), { headers: initDataHeaders() }).then((response) => response.ok ? response.json() : null).then((data: { groupId: string | null } | null) => {
      if (!active || changedByUser.current || !data?.groupId) return
      localStorage.setItem(storageKey, data.groupId); setGroupId(data.groupId)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  const selectGroup = (id: string) => {
    changedByUser.current = true
    setGroupId(id); localStorage.setItem(storageKey, id); setSyncNotice('')
    void fetch(apiUrl('/api/profile/schedule-group'), { method: 'PUT', headers: { ...initDataHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: id }) }).then((response) => { if (!response.ok) throw new Error() }).catch(() => setSyncNotice('Группа сохранена на этом устройстве; синхронизация временно недоступна.'))
  }
  return { groups, groupId, selectGroup, syncNotice, loadingGroups }
}

export function ScheduleGroupPreference() {
  const state = useScheduleGroup()
  const [editing, setEditing] = useState(false)
  const group = state.groups.find((item) => item.id === state.groupId)
  return <section className="schedule-profile-block"><div><p className="eyebrow">Учебная группа</p><strong>{state.loadingGroups ? 'Загружаем…' : group?.name || 'Не выбрана'}</strong></div><button className="button button--quiet" type="button" onClick={() => setEditing(!editing)}>{editing ? 'Скрыть' : group ? 'Изменить' : 'Выбрать'}</button>{editing && <GroupPicker {...state} onSelect={(id) => { state.selectGroup(id); setEditing(false) }} />}{state.syncNotice && <small role="status">{state.syncNotice}</small>}</section>
}

function GroupPicker({ groups, loadingGroups, onSelect }: { groups: Group[]; loadingGroups: boolean; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const options = useRef<HTMLDivElement>(null)
  const matches = groups.filter((group) => group.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))).slice(0, 30)
  if (loadingGroups) return <p role="status">Загружаем список групп…</p>
  return <div className="schedule-group-picker"><label>Найдите свою группу<input role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls="schedule-group-options" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); options.current?.querySelector('button')?.focus() } }} placeholder="Например, ИУ5-34Б" /></label><div className="schedule-group-options" id="schedule-group-options" ref={options} role="group" aria-label="Список групп ИУ5">{matches.length ? matches.map((group) => <button type="button" key={group.id} onClick={() => onSelect(group.id)}>{group.name}</button>) : <p>Группы не найдены.</p>}</div></div>
}

function SchedulePage() {
  const { groups, groupId, selectGroup, syncNotice, loadingGroups } = useScheduleGroup()
  const [mode, setMode] = useState<'today' | 'week'>('today')
  const [selectedDate, setSelectedDate] = useState(dateInMoscow)
  const [result, setResult] = useState<{ groupId: string; schedule?: Schedule; error?: string } | null>(null)
  const [choosing, setChoosing] = useState(false)
  useEffect(() => {
    if (!groupId) return
    let active = true
    void fetch(`/data/schedule/groups/${encodeURIComponent(groupId)}.json`).then((response) => { if (!response.ok) throw new Error(response.status === 404 ? 'Эта группа больше недоступна.' : 'Расписание временно недоступно.'); return response.json() }).then((data: Schedule) => { if (active) setResult({ groupId, schedule: data }) }).catch((reason: unknown) => { if (active) setResult({ groupId, error: reason instanceof Error ? reason.message : 'Расписание временно недоступно.' }) })
    return () => { active = false }
  }, [groupId])
  const loading = !!groupId && result?.groupId !== groupId
  const schedule = result?.groupId === groupId ? result.schedule ?? null : null
  const error = result?.groupId === groupId ? result.error ?? '' : ''
  const today = dateInMoscow()
  const monday = mondayOf(selectedDate)
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(monday, index)), [monday])
  const currentDay = mode === 'today' ? today : selectedDate
  const lessons = schedule?.days[currentDay] ?? []
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const ongoing = lessons.find((lesson) => lesson.start <= now && now < lesson.end)
  const next = lessons.find((lesson) => lesson.start > now)
  const weekNumber = schedule ? Math.max(1, Math.floor((Date.parse(`${mondayOf(currentDay)}T00:00:00Z`) - Date.parse(`${mondayOf(schedule.semester.weekOneStart)}T00:00:00Z`)) / 604800000) + 1) : 0
  const termLabel = schedule?.semester.term === 1 || schedule?.semester.term === '1' ? 'осень' : schedule?.semester.term === 2 || schedule?.semester.term === '2' ? 'весна' : schedule?.semester.term
  return <section className="schedule-page">
    <p className="eyebrow">Учебное расписание</p><h1>Расписание</h1>
    {!groupId ? <><p className="lead">Выберите учебную группу, чтобы открыть расписание.</p>{loadingGroups ? <p role="status">Загружаем список групп…</p> : groups.length ? <GroupPicker groups={groups} loadingGroups={false} onSelect={selectGroup} /> : <p role="alert">Список групп пока недоступен.</p>}</> : <>
      <div className="schedule-group-heading"><strong>{schedule?.group.name || groups.find((item) => item.id === groupId)?.name || groupId}</strong><button type="button" className="button button--quiet" onClick={() => setChoosing(!choosing)}>{choosing ? 'Отмена' : 'Изменить'}</button></div>
      {choosing && <GroupPicker groups={groups} loadingGroups={loadingGroups} onSelect={(id) => { selectGroup(id); setChoosing(false) }} />}
      {syncNotice && <p className="schedule-notice" role="status">{syncNotice}</p>}
      <div className="schedule-mode" role="group" aria-label="Период расписания"><button aria-pressed={mode === 'today'} onClick={() => setMode('today')}>Сегодня</button><button aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Неделя</button></div>
      {mode === 'week' && <div className="schedule-days" role="group" aria-label="Дни недели">{weekDays.map((date) => <button key={date} aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)}><strong>{shortDate(date)}</strong></button>)}</div>}
      {schedule && <p className="schedule-meta">{[schedule.semester.academicYear, termLabel, `${weekNumber}-я неделя`, weekNumber % 2 ? 'числитель' : 'знаменатель'].filter(Boolean).join(' · ')}</p>}
      {loading ? <p role="status">Загружаем расписание…</p> : error ? <div className="empty"><h2>Расписание недоступно</h2><p>{error}</p></div> : !schedule ? null : schedule.availability === 'no-schedule' ? <div className="empty"><h2>Расписание пока не опубликовано</h2><p>ЛКС МГТУ пока не предоставил расписание для этой группы.</p></div> : lessons.length ? <div className="schedule-lessons" role="region" aria-label="Занятия" tabIndex={0}>{lessons.map((lesson, index) => <article className="schedule-lesson" key={`${lesson.start}-${lesson.subject}-${index}`}><div className="schedule-time">{lesson.start} — {lesson.end}<strong>{currentDay === today ? ongoing === lesson ? 'Сейчас' : next === lesson ? 'Следующая' : '' : ''}</strong></div><h2>{lesson.subject}</h2>{lesson.type && <p>{lesson.type}</p>}{(lesson.location || lesson.teacher) && <small>{[lesson.location, lesson.teacher].filter(Boolean).join(' · ')}</small>}</article>)}</div> : <div className="empty"><h2>{mode === 'today' ? 'Сегодня занятий нет' : 'В этот день занятий нет'}</h2></div>}
      {schedule && <p className="schedule-updated">Обновлено {new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(new Date(schedule.source.syncedAt))} · Источник: {schedule.source.provider}</p>}
    </>}
  </section>
}

export default SchedulePage
