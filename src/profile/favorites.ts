import { apiUrl, initDataHeaders } from '../api'
import type { DiskItem } from '../domain/types'

export interface Favorite extends DiskItem { courseId: string; createdAt: number }
export type FavoriteInput = Pick<Favorite, 'courseId' | 'path' | 'type' | 'name'>
export const favoriteKey = ({ courseId, path }: Pick<FavoriteInput, 'courseId' | 'path'>) => JSON.stringify([courseId, path])

const request = async (method: 'GET' | 'PUT' | 'DELETE', item?: FavoriteInput | Pick<FavoriteInput, 'courseId' | 'path'>) => {
  const response = await fetch(apiUrl('/api/profile/favorites'), {
    method,
    headers: { ...initDataHeaders(), ...(item ? { 'Content-Type': 'application/json' } : {}) },
    body: item ? JSON.stringify(item) : undefined,
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Откройте приложение через Telegram, чтобы пользоваться избранным.' : 'Не удалось сохранить избранное. Попробуйте ещё раз.')
  return response
}

export const getFavorites = async (): Promise<Favorite[]> => (await (await request('GET')).json() as { items: Favorite[] }).items
export const addFavorite = async (item: FavoriteInput) => { await request('PUT', { courseId: item.courseId, path: item.path, type: item.type, name: item.name }) }
export const removeFavorite = async (item: FavoriteInput) => { await request('DELETE', { courseId: item.courseId, path: item.path }) }
