import { afterEach, describe, expect, it, vi } from 'vitest'
import { yandexDiskRepository } from './materials-repository'
import { courses } from '../data/courses'

describe('Yandex Disk public repository', () => {
  const originalCourseUrls = courses.map(({ publicUrl }) => publicUrl)
  afterEach(() => { vi.unstubAllGlobals(); courses.forEach((course, index) => { course.publicUrl = originalCourseUrls[index] }) })

  it('uses the configured public key and encodes nested paths', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ _embedded: { items: [{ name: 'Тема 1', path: 'disk:/Тема 1', type: 'dir' }] } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(yandexDiskRepository.getFolder('course-1', 'disk:/Модуль 1')).resolves.toEqual([{ name: 'Тема 1', path: 'disk:/Тема 1', type: 'dir', modified: undefined }])
    expect(fetchMock.mock.calls[0][0]).toContain('path=disk%3A%2F%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C+1')
  })

  it('rejects an untrusted download URL', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ href: 'https://example.com/file.pdf' }))))
    await expect(yandexDiskRepository.getFileUrl('course-1', 'disk:/file.pdf')).rejects.toThrow('недопустимую')
  })

  it('accepts the Yandex download host', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ href: 'https://downloader.disk.yandex.ru/disk/file.pdf' }))))
    await expect(yandexDiskRepository.getFileUrl('course-1', 'disk:/file.pdf')).resolves.toBe('https://downloader.disk.yandex.ru/disk/file.pdf')
  })

  it('searches nested public folders and files', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = ''
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url).searchParams.get('path')
      const items = path ? [{ name: 'Конспект.pdf', path: '/Математика/Конспект.pdf', type: 'file' }] : [{ name: 'Математика', path: '/Математика', type: 'dir' }]
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items } })))
    }))
    await expect(yandexDiskRepository.searchDisk('конспект')).resolves.toEqual([{ name: 'Конспект.pdf', path: '/Математика/Конспект.pdf', type: 'file', modified: undefined, courseId: 'course-1', courseTitle: 'Курс 1' }])
  })

  it('continues searching when one folder request fails', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = ''
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url).searchParams.get('path')
      if (path === '/Недоступна') return Promise.resolve(new Response('', { status: 503 }))
      const items = path ? [{ name: 'Математика', path: '/Мат/Математика', type: 'dir' }] : [{ name: 'Недоступна', path: '/Недоступна', type: 'dir' }, { name: 'Мат', path: '/Мат', type: 'dir' }]
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items } })))
    }))
    await expect(yandexDiskRepository.searchDisk('математика')).resolves.toEqual([{ name: 'Математика', path: '/Мат/Математика', type: 'dir', modified: undefined, courseId: 'course-1', courseTitle: 'Курс 1' }])
  })

  it('finds names with decomposed Cyrillic characters', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = ''
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url).searchParams.get('path')
      const items = path ? [{ name: 'Математический анализ', path: '/1/Математический анализ', type: 'dir' }] : [{ name: '1 семестр', path: '/1', type: 'dir' }]
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items } })))
    }))
    await expect(yandexDiskRepository.searchDisk('Математический')).resolves.toMatchObject([{ name: 'Математический анализ' }])
  })
})
