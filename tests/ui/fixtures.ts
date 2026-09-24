/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test'

type TelegramState = { ready: number; visible: boolean; opened: string[] }

const folders: Record<string, Array<{ name: string; path: string; type: 'dir' | 'file' }>> = {
  'course-1:': [
    { name: '1 семестр', path: '1 семестр', type: 'dir' },
    { name: 'Математический анализ', path: 'Математический анализ', type: 'dir' },
    { name: 'Архив', path: 'Архив', type: 'dir' },
    { name: 'Очень длинное название папки для проверки переноса текста на маленьком экране', path: 'long', type: 'dir' },
  ],
  'course-1:1 семестр': [
    { name: 'Алгебра', path: '1 семестр/Алгебра', type: 'dir' },
    { name: 'Лекция 1.pdf', path: '1 семестр/Лекция 1.pdf', type: 'file' },
    { name: 'Лекции Грибов АФ.pdf', path: '1 семестр/Лекции Грибов АФ.pdf', type: 'file' },
  ],
  'course-1:1 Семестр': [
    { name: 'Модели данных', path: '1 Семестр/Модели данных', type: 'dir' },
    { name: 'Электротехника', path: '1 Семестр/Электротехника', type: 'dir' },
    { name: 'Парадигмы и конструкции языков программирования', path: '1 Семестр/Парадигмы и конструкции языков программирования', type: 'dir' },
    { name: 'Практическая работа по программированию РЛ-6.pdf', path: '1 Семестр/Практическая работа по программированию РЛ-6.pdf', type: 'file' },
  ],
  'course-1:Математический анализ': [{ name: 'Пределы.pdf', path: 'Математический анализ/Пределы.pdf', type: 'file' }],
  'course-1:Архив': [{ name: '2026', path: 'Архив/2026', type: 'dir' }],
  'course-1:Архив/2026': [{ name: 'ИУ5', path: 'Архив/2026/ИУ5', type: 'dir' }],
  'course-1:Архив/2026/ИУ5': [{ name: 'УТП', path: 'Архив/2026/ИУ5/УТП', type: 'dir' }],
  'course-1:Архив/2026/ИУ5/УТП': [{ name: 'УТП-файл.pdf', path: 'Архив/2026/ИУ5/УТП/УТП-файл.pdf', type: 'file' }],
  'course-1:long': [],
  'course-2:': [{ name: '2 семестр', path: '2 семестр', type: 'dir' }],
  'course-2:2 семестр': [],
}

export const test = base.extend<{ telegram: TelegramState }>({
  page: async ({ page }, use) => {
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }))
    await page.addInitScript(() => {
      const listeners = new Set<() => void>()
      const eventListeners = new Map<string, Set<() => void>>()
      const state = { ready: 0, visible: false, opened: [] as string[] }
      ;(window as Window & { __telegram: typeof state }).__telegram = state
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit = (event) => eventListeners.get(event)?.forEach((listener) => listener())
      ;(window as Window & { Telegram: unknown }).Telegram = { WebApp: {
        initData: 'query_id=test&user=%7B%22id%22%3A1%7D&auth_date=1&hash=test', initDataUnsafe: { user: { id: 1, first_name: 'Студент с очень длинным именем для проверки адаптивной вёрстки', username: 'student' } },
        themeParams: { bg_color: '#f6faff', text_color: '#1a1a19' }, colorScheme: 'light', viewportHeight: 844, viewportStableHeight: 844,
        safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 }, contentSafeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
        ready: () => { state.ready += 1 }, expand: () => {}, openLink: (url: string) => { state.opened.push(url) },
        onEvent: (event: string, listener: () => void) => { if (!eventListeners.has(event)) eventListeners.set(event, new Set()); eventListeners.get(event)!.add(listener) },
        offEvent: (event: string, listener: () => void) => { eventListeners.get(event)?.delete(listener) },
        BackButton: { show: () => { state.visible = true }, hide: () => { state.visible = false }, onClick: (listener: () => void) => listeners.add(listener), offClick: (listener: () => void) => listeners.delete(listener), trigger: () => listeners.forEach((listener) => listener()) },
      } }
    })
    await page.route('https://cloud-api.yandex.net/**', async (route) => {
      const url = new URL(route.request().url())
      const courseId = url.searchParams.get('public_key')?.includes('PoeWdke') ? 'course-2' : 'course-1'
      const path = url.searchParams.get('path') ?? ''
      if (url.pathname.endsWith('/download')) return route.fulfill({ json: { href: 'https://downloader.disk.yandex.ru/disk/public/file.pdf' } })
      const items = folders[`${courseId}:${path}`]
      if (items === undefined) return route.fulfill({ status: 404, json: { message: 'not found' } })
      await route.fulfill({ json: { _embedded: { items } } })
    })
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: false } }))
    await page.route('**/api/analytics/**', (route) => route.fulfill({ status: 204 }))
    await use(page)
  },
  telegram: async ({ page }, use) => { await use(await page.evaluate(() => (window as Window & { __telegram: TelegramState }).__telegram)) },
})

export { expect }
