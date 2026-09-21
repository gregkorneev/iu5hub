import { useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryNames, type Category, type DiskSearchResult, type Material, type Subject } from './domain/types'
import { staticMaterialsRepository as repository } from './repositories/materials-repository'
import { track } from './analytics'

export function MaterialTag({ category }: { category: Category }) {
  return <span className={`tag tag--${category}`}>{categoryNames[category]}</span>
}

export function SearchBox({ initial = '', compact = false }: { initial?: string; compact?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initial)
  const [suggestions, setSuggestions] = useState<{ query: string; items: DiskSearchResult[] }>({ query: '', items: [] })
  const [focused, setFocused] = useState(false)
  const listId = useId()
  useEffect(() => {
    if (query.trim().length < 2) return
    let active = true
    const timeout = globalThis.setTimeout(() => {
      void repository.searchDisk(query).then((results) => { if (active) setSuggestions({ query, items: results.slice(0, 5) }) }).catch(() => { if (active) setSuggestions({ query, items: [] }) })
    }, 250)
    return () => { active = false; globalThis.clearTimeout(timeout) }
  }, [query])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    if (value) { track('search'); navigate(`/search?q=${encodeURIComponent(value)}`) }
  }
  const currentSuggestions = suggestions.query === query ? suggestions.items : []
  return <div className="search-shell"><form className={`search ${compact ? 'search--compact' : ''}`} role="search" onSubmit={submit}><label className="sr-only" htmlFor={listId}>Поиск в папках и файлах</label><input id={listId} name="q" type="search" value={query} onFocus={() => setFocused(true)} onBlur={() => globalThis.setTimeout(() => setFocused(false), 150)} onChange={({ target }) => setQuery(target.value)} placeholder="Найти папку или файл" autoComplete="off" /><button type="submit">Найти</button></form>{focused && query.trim().length >= 2 && currentSuggestions.length > 0 && <div className="search-suggestions" aria-label="Подсказки поиска">{currentSuggestions.map((item) => <button key={`${item.courseId}-${item.path}`} type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(item.name)}`)}><strong>{item.name}</strong><small>{item.courseTitle} · {item.type === 'dir' ? 'папка' : 'файл'}</small></button>)}</div>}</div>
}

export function SubjectCard({ subject, count }: { subject: Subject; count?: number }) {
  return <Link className="subject-card" to={`/subject/${subject.id}`} style={{ '--subject-color': subject.color } as CSSProperties}><span className="subject-card__mark" aria-hidden="true" /> <span className="subject-card__content"><strong>{subject.title}</strong><small>{subject.description}</small>{count !== undefined && <em>{count} материалов</em>}</span><span className="subject-card__arrow" aria-hidden="true">→</span></Link>
}

export function MaterialCard({ material, subject }: { material: Material; subject: Subject }) {
  return <Link className="material-card" to={`/material/${material.id}`}><MaterialTag category={material.category} /><strong>{material.title}</strong><span>{subject.title}</span>{material.description && <small>{material.description}</small>}</Link>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="empty"><h2>{title}</h2><p>{children}</p><Link className="button button--quiet" to="/">На главную</Link></section>
}
