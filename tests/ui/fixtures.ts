/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test'

type TelegramState = { ready: number; visible: boolean; opened: string[] }

const folders: Record<string, Array<{ name: string; path: string; type: 'dir' | 'file' }>> = {
  'course-1:': [
    { name: '1 семестр', path: '1 семестр', type: 'dir' },
    { name: 'Математический анализ', path: 'Математический анализ', type: 'dir' },
    { name: 'Очень длинное название папки для проверки переноса текста на маленьком экране', path: 'long', type: 'dir' },
  ],
  'course-1:1 семестр': [
    { name: 'Алгебра', path: '1 семестр/Алгебра', type: 'dir' },
    { name: 'Лекция 1.pdf', path: '1 семестр/Лекция 1.pdf', type: 'file' },
  ],
  'course-1:Математический анализ': [{ name: 'Пределы.pdf', path: 'Математический анализ/Пределы.pdf', type: 'file' }],
  'course-1:long': [],
  'course-2:': [{ name: '2 семестр', path: '2 семестр', type: 'dir' }],
  'course-2:2 семестр': [],
}

export const test = base.extend<{ telegram: TelegramState }>({
  page: async ({ page }, use) => {
    await page.route('https://telegram.org/js/telegram-web-app.js', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }))
    await page.addInitScript(() => {
      const listeners = new Set<() => void>()
      const state = { ready: 0, visible: false, opened: [] as string[] }
      ;(window as Window & { __telegram: typeof state }).__telegram = state
      ;(window as Window & { Telegram: unknown }).Telegram = { WebApp: {
        initDataUnsafe: { user: { id: 1, first_name: 'Студент с очень длинным именем для проверки адаптивной вёрстки', username: 'student' } },
        themeParams: { bg_color: '#f6faff', text_color: '#1a1a19' }, colorScheme: 'light', viewportHeight: 844, viewportStableHeight: 844,
        safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 }, contentSafeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
        ready: () => { state.ready += 1 }, expand: () => {}, openLink: (url: string) => { state.opened.push(url) }, onEvent: () => {}, offEvent: () => {},
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
    await use(page)
  },
  telegram: async ({ page }, use) => { await use(await page.evaluate(() => (window as Window & { __telegram: TelegramState }).__telegram)) },
})

export { expect }
