import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryNames, type Category, type Material, type Subject } from './domain/types'
import { searchFolders } from './repositories/folder-search'
import { track } from './analytics'

export function MaterialTag({ category }: { category: Category }) {
  return <span className={`tag tag--${category}`}>{categoryNames[category]}</span>
}

export function SearchBox({ initial = '', compact = false }: { initial?: string; compact?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initial)
  const [focused, setFocused] = useState(false)
  const listId = useId()
  const currentSuggestions = query.trim() ? searchFolders(query).slice(0, 8) : []
  const openFolder = (item: { courseId: string; diskPath: string }) => navigate(`/course/${item.courseId}?path=${encodeURIComponent(item.diskPath)}`)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    if (value) { track('search'); navigate(`/search?q=${encodeURIComponent(value)}`) }
  }
  return <div className="search-shell"><form className={`search ${compact ? 'search--compact' : ''}`} role="search" onSubmit={submit}><label className="sr-only" htmlFor={listId}>Поиск по тегам и преподавателям</label><input id={listId} name="q" type="search" value={query} onFocus={() => setFocused(true)} onBlur={() => globalThis.setTimeout(() => setFocused(false), 150)} onChange={({ target }) => setQuery(target.value)} placeholder="Найти по тегу или преподавателю" autoComplete="off" /><button type="submit">Найти</button></form>{focused && currentSuggestions.length > 0 && <div className="search-suggestions" aria-label="Подсказки поиска">{currentSuggestions.map((item) => <button key={item.objectKey} type="button" onClick={() => openFolder(item)}><strong>{item.name}</strong><small>{item.path} · {item.matchedTerms.join(', ')}</small></button>)}</div>}</div>
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
