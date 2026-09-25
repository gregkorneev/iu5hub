/* eslint-disable react-refresh/only-export-components -- Provider and hook share one context. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addFavorite, favoriteKey, getFavorites, removeFavorite, type Favorite, type FavoriteInput } from './favorites'

interface FavoritesState {
  items: Favorite[]
  keys: Set<string>
  loading: boolean
  error: string
  notice: string
  pending: Set<string>
  toggle(item: FavoriteInput): Promise<void>
  retry(): void
}
const FavoritesContext = createContext<FavoritesState | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [version, setVersion] = useState(0)
  const pendingRef = useRef(new Set<string>())
  useEffect(() => {
    let active = true
    void getFavorites().then((loaded) => { if (active) { setItems(loaded); setError(''); setLoading(false) } }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить избранное.'); setLoading(false) } })
    return () => { active = false }
  }, [version])
  const keys = useMemo(() => new Set(items.map(favoriteKey)), [items])
  const toggle = async (item: FavoriteInput) => {
    const key = favoriteKey(item)
    if (loading || error || pendingRef.current.has(key)) return
    const previous = items
    const exists = keys.has(key)
    setNotice('')
    pendingRef.current.add(key)
    setPending(new Set(pendingRef.current))
    setItems((current) => exists ? current.filter((entry) => favoriteKey(entry) !== key) : [{ ...item, createdAt: Math.floor(Date.now() / 1000) }, ...current])
    try { if (exists) await removeFavorite(item); else await addFavorite(item) }
    catch { setItems((current) => exists ? [...current, ...previous.filter((entry) => favoriteKey(entry) === key)].sort((a, b) => b.createdAt - a.createdAt) : current.filter((entry) => favoriteKey(entry) !== key)); setNotice('Не удалось сохранить избранное. Попробуйте ещё раз.') }
    finally { pendingRef.current.delete(key); setPending(new Set(pendingRef.current)) }
  }
  return <FavoritesContext.Provider value={{ items, keys, loading, error, notice, pending, toggle, retry: () => { setLoading(true); setError(''); setNotice(''); setVersion((value) => value + 1) } }}>{children}</FavoritesContext.Provider>
}

export const useFavorites = () => {
  const state = useContext(FavoritesContext)
  if (!state) throw new Error('FavoritesProvider is required')
  return state
}
