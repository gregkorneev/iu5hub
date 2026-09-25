import { afterEach, expect, it, vi } from 'vitest'
import { addFavorite, getFavorites, removeFavorite } from './favorites'

afterEach(() => { vi.unstubAllGlobals() })

it('uses signed Telegram data and the correct payload for favorite mutations', async () => {
  vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'signed-data' } } })
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  const item = { courseId: 'course-1', path: 'disk:/Семестр/Лекция.pdf', type: 'file' as const, name: 'Лекция.pdf', modified: '2026-09-25' }
  expect(await getFavorites()).toEqual([])
  await addFavorite(item)
  await removeFavorite(item)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  for (const [, options] of fetchMock.mock.calls) expect(options.headers['X-Telegram-Init-Data']).toBe('signed-data')
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ courseId: item.courseId, path: item.path, type: item.type, name: item.name })
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ courseId: item.courseId, path: item.path })
})
