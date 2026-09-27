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
  if (!response.ok) {
    const message = response.status === 401
      ? 'Откройте приложение через Telegram, чтобы пользоваться избранным.'
      : method === 'GET'
        ? 'Не удалось загрузить избранное. Проверьте подключение и попробуйте ещё раз.'
        : 'Не удалось сохранить избранное. Попробуйте ещё раз.'
    throw new Error(message)
  }
  return response
}

export const getFavorites = async (): Promise<Favorite[]> => {
  try {
    const payload = await (await request('GET')).json() as { items?: unknown }
    if (!Array.isArray(payload.items)) throw new Error('Invalid favorites response')
    return payload.items as Favorite[]
  } catch (error) {
    if (error instanceof Error && error.message === 'Откройте приложение через Telegram, чтобы пользоваться избранным.') throw error
    throw new Error('Не удалось загрузить избранное. Проверьте подключение и попробуйте ещё раз.')
  }
}
export const addFavorite = async (item: FavoriteInput) => { await request('PUT', { courseId: item.courseId, path: item.path, type: item.type, name: item.name }) }
export const removeFavorite = async (item: FavoriteInput) => { await request('DELETE', { courseId: item.courseId, path: item.path }) }
