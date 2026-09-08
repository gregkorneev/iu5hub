import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryNames, type Material, type Subject } from './domain/types'

export function SearchBox({ initial = '', compact = false }: { initial?: string; compact?: boolean }) {
  const navigate = useNavigate()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('q')?.toString().trim()
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`)
  }
  return <form className={`search ${compact ? 'search--compact' : ''}`} role="search" onSubmit={submit}><label className="sr-only" htmlFor="search-input">Поиск материалов</label><input id="search-input" name="q" type="search" defaultValue={initial} placeholder="Найти лекцию, предмет или тему" /><button type="submit">Найти</button></form>
}

export function SubjectCard({ subject, count }: { subject: Subject; count?: number }) {
  return <Link className="subject-card" to={`/subject/${subject.id}`} style={{ '--subject-color': subject.color } as CSSProperties}><span className="subject-card__mark" aria-hidden="true" /> <span><strong>{subject.title}</strong><small>{subject.description}</small>{count !== undefined && <em>{count} материалов</em>}</span><span aria-hidden="true">→</span></Link>
}

export function MaterialCard({ material, subject }: { material: Material; subject: Subject }) {
  return <Link className="material-card" to={`/material/${material.id}`}><span className="tag">{categoryNames[material.category]}</span><strong>{material.title}</strong><span>{subject.title}</span>{material.description && <small>{material.description}</small>}</Link>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="empty"><h2>{title}</h2><p>{children}</p><Link className="button button--quiet" to="/">На главную</Link></section>
}
