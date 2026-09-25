import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { yandexDiskRepository } from './materials-repository'
import { courses } from '../data/courses'

describe('Yandex Disk public repository', () => {
  const originalCourses = courses.map(({ publicUrl, rootPath }) => ({ publicUrl, rootPath }))
  beforeEach(() => { courses[2].publicUrl = '' })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); courses.forEach((course, index) => { course.publicUrl = originalCourses[index].publicUrl; course.rootPath = originalCourses[index].rootPath }) })

  it('uses the configured public key and encodes nested paths', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ _embedded: { items: [{ name: 'Тема 1', path: 'disk:/Тема 1', type: 'dir' }] } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(yandexDiskRepository.getFolder('course-1', 'disk:/Модуль 1')).resolves.toEqual([{ name: 'Тема 1', path: 'disk:/Тема 1', type: 'dir', modified: undefined }])
    expect(fetchMock.mock.calls[0][0]).toContain('path=disk%3A%2F%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C+1')
  })

  it('opens a nested public course root and prefixes relative or absolute paths only once', async () => {
    courses[2].publicUrl = 'https://disk.yandex.com/d/course-three'
    courses[2].rootPath = '/IU5/3 course'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { items: [{ name: '5 sem', path: '/IU5/3 course/5 sem', type: 'dir' }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { items: [{ name: 'ОАД', path: '/IU5/3 course/5 sem/ОАД', type: 'dir' }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { items: [{ name: 'нирс', path: '/IU5/3 course/5 sem/ОАД/нирс', type: 'dir' }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ href: 'https://downloader.disk.yandex.ru/disk/file.pdf' })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(yandexDiskRepository.getFolder('course-3')).resolves.toEqual([{ name: '5 sem', path: '/IU5/3 course/5 sem', type: 'dir', modified: undefined }])
    await expect(yandexDiskRepository.getFolder('course-3', '/IU5/3 course/5 sem')).resolves.toEqual([{ name: 'ОАД', path: '/IU5/3 course/5 sem/ОАД', type: 'dir', modified: undefined }])
    await expect(yandexDiskRepository.getFolder('course-3', '/5 sem/ОАД')).resolves.toEqual([{ name: 'нирс', path: '/IU5/3 course/5 sem/ОАД/нирс', type: 'dir', modified: undefined }])
    await expect(yandexDiskRepository.getFileUrl('course-3', '/IU5/3 course/5 sem/ОАД/нирс/file.pdf')).resolves.toBe('https://downloader.disk.yandex.ru/disk/file.pdf')
    expect(fetchMock.mock.calls.map(([url]) => new URL(url as string).searchParams.get('path'))).toEqual([
      '/IU5/3 course',
      '/IU5/3 course/5 sem',
      '/IU5/3 course/5 sem/ОАД',
      '/IU5/3 course/5 sem/ОАД/нирс/file.pdf',
    ])
  })

  it('searches within course 3 starting at its nested share path', async () => {
    courses[0].publicUrl = ''
    courses[1].publicUrl = ''
    courses[2].publicUrl = 'https://disk.yandex.com/d/course-three'
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url).searchParams.get('path') ?? ''
      calls.push(path)
      const items = path === '/IU5/3 course'
        ? [{ name: '5 sem', path: '/IU5/3 course/5 sem', type: 'dir' }]
        : path === '/IU5/3 course/5 sem'
          ? [{ name: 'ОАД', path: '/IU5/3 course/5 sem/ОАД', type: 'dir' }]
          : [{ name: 'ОАД лекция.pdf', path: '/IU5/3 course/5 sem/ОАД лекция.pdf', type: 'file' }]
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items } })))
    }))
    await expect(yandexDiskRepository.searchDisk('оад')).resolves.toEqual([
      { name: 'ОАД', path: '/IU5/3 course/5 sem/ОАД', type: 'dir', modified: undefined, courseId: 'course-3', courseTitle: 'Курс 3' },
      { name: 'ОАД лекция.pdf', path: '/IU5/3 course/5 sem/ОАД лекция.pdf', type: 'file', modified: undefined, courseId: 'course-3', courseTitle: 'Курс 3' },
    ])
    expect(calls[0]).toBe('/IU5/3 course')
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

  it('includes matches from every configured course', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = 'https://disk.yandex.ru/d/course-two'
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const key = new URL(url).searchParams.get('public_key')
      const path = key?.endsWith('course-one') ? '/first.pdf' : '/second.pdf'
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items: [{ name: 'Лекция.pdf', path, type: 'file' }] } })))
    }))

    await expect(yandexDiskRepository.searchDisk('лекция')).resolves.toMatchObject([
      { courseId: 'course-1', path: '/first.pdf' },
      { courseId: 'course-2', path: '/second.pdf' },
    ])
  })

  it('returns completed course matches when another course exceeds the search deadline', async () => {
    vi.useFakeTimers()
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = 'https://disk.yandex.ru/d/course-two'
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (new URL(url).searchParams.get('public_key')?.endsWith('course-two')) return new Promise<Response>(() => undefined)
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items: [{ name: 'Лекция.pdf', path: '/first.pdf', type: 'file' }] } })))
    }))

    const search = yandexDiskRepository.searchDisk('лекция')
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(search).resolves.toMatchObject([{ courseId: 'course-1', path: '/first.pdf' }])
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

  it('follows matching folders until it finds a nested matching file', async () => {
    courses[0].publicUrl = 'https://disk.yandex.ru/d/course-one'
    courses[1].publicUrl = ''
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url).searchParams.get('path') ?? ''
      const items = path === '' ? [{ name: 'Архив', path: '/Архив', type: 'dir' }] : path === '/Архив' ? [{ name: 'УТП', path: '/Архив/УТП', type: 'dir' }] : [{ name: 'УТП.pdf', path: '/Архив/УТП/УТП.pdf', type: 'file' }]
      return Promise.resolve(new Response(JSON.stringify({ _embedded: { items } })))
    }))
    await expect(yandexDiskRepository.searchDisk('утп')).resolves.toMatchObject([{ name: 'УТП' }, { name: 'УТП.pdf' }])
  })
})
