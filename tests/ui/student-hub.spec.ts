import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

test.describe('Student Hub critical UI', () => {
  test('starts in Telegram, exposes courses, and has no serious accessibility violations', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Материалы на Яндекс.Диске' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Курс 1/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()
    await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { ready: number } }).__telegram.ready)).toBe(1)
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([])
    expect(consoleErrors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
  })

  test('navigates folders, downloads an allowlisted file, and keeps no horizontal overflow', async ({ page }) => {
    await page.goto('/#/course/course-1')
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toContainText('Каталог')
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toContainText('Поиск')
    await page.getByRole('link', { name: /1 семестр/ }).click()
    await expect(page.getByRole('button', { name: 'Лекция 1.pdf Скачать файл' })).toBeVisible()
    const downloadCall = page.waitForRequest((request) => request.url().includes('/download'))
    await page.getByRole('button', { name: /Скачать Лекция 1.pdf/ }).click()
    await downloadCall
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('aligns every file download control to the same card edge', async ({ page }) => {
    for (const route of ['/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80', '/#/search?q=pdf']) {
      await page.goto(route)
      await expect(page.getByRole('button', { name: 'Скачать Лекция 1.pdf' })).toBeVisible()
      expect(await page.locator('.disk-file').evaluateAll((cards) => {
        const edges = cards.map((card) => {
          const cardBox = card.getBoundingClientRect()
          const buttonBox = card.querySelector<HTMLButtonElement>('.download-button')!.getBoundingClientRect()
          return { inset: cardBox.right - buttonBox.right, buttonRight: buttonBox.right }
        })
        return edges.every(({ inset }) => Math.abs(inset - edges[0].inset) < 1)
          && edges.every(({ buttonRight }) => Math.abs(buttonRight - edges[0].buttonRight) < 1)
      })).toBeTruthy()
    }
  })

  test('does not show a stale download error after navigation', async ({ page }) => {
    await page.goto('/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
    await page.route('**/resources/download?**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      await route.fulfill({ status: 500, json: { message: 'temporary failure' } })
    })
    await page.getByRole('button', { name: 'Скачать Лекция 1.pdf' }).click()
    await page.getByRole('link', { name: 'К корню курса' }).click()
    await expect(page.getByRole('heading', { name: 'Курс 1' })).toBeVisible()
    await expect(page.getByText('Каталог пока недоступен')).toBeHidden()
  })

  test('searches Russian text, handles no results and clears stale suggestions', async ({ page }) => {
    await page.goto('/#/search')
    const input = page.getByRole('searchbox', { name: 'Поиск в папках и файлах' })
    await input.fill('мат')
    await expect(page.getByLabel('Подсказки поиска')).toContainText('Математический анализ')
    await input.fill('x')
    await expect(page.getByLabel('Подсказки поиска')).toBeHidden()
    await input.fill('несуществующий материал')
    await input.press('Enter')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
  })

  test('finds a file below a matching folder at deep nesting', async ({ page }) => {
    await page.goto('/#/search?q=%D0%A3%D0%A2%D0%9F')
    await expect(page.getByText('УТП-файл.pdf')).toBeVisible()
  })

  test('ends a stalled live Disk search with an error instead of an endless loader', async ({ page }) => {
    test.setTimeout(20_000)
    await page.unroute('https://cloud-api.yandex.net/**')
    await page.route('**/v1/disk/public/resources**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 11_000))
      await route.fulfill({ json: { _embedded: { items: [] } } })
    })
    await page.goto('/#/search?q=%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9%20%D0%B0%D0%BD%D0%B0%D0%BB%D0%B8%D0%B7')
    await expect(page.getByText('Не удалось выполнить поиск по Яндекс.Диску.')).toBeVisible({ timeout: 13_000 })
    await expect(page.getByText('Ищем в папках и файлах…')).toBeHidden()
  })

  test('keeps home search suggestions tappable above the course catalog on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    await page.getByRole('searchbox', { name: 'Поиск в папках и файлах' }).fill('ma')
    const suggestion = page.getByLabel('Подсказки поиска').getByRole('button', { name: /Математический анализ/ })
    await expect(suggestion).toBeVisible()
    expect(await suggestion.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
    })).toBeTruthy()
  })

  test('locks the home page to the Telegram viewport without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    expect(await page.evaluate(() => {
      window.scrollTo(100, 100)
      return document.documentElement.scrollWidth <= innerWidth
        && document.documentElement.scrollHeight <= innerHeight
        && scrollX === 0 && scrollY === 0
    })).toBeTruthy()
  })

  test('scrolls the home page vertically without horizontal overflow in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/#/')
    expect(await page.evaluate(() => {
      window.scrollTo(0, 100)
      return document.documentElement.scrollWidth <= innerWidth
        && document.documentElement.scrollHeight > innerHeight
        && scrollX === 0 && scrollY > 0
    })).toBeTruthy()
  })

  test('supports direct hash routes and Telegram BackButton navigation', async ({ page }) => {
    await page.goto('/#/course/course-1')
    await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { visible: boolean } }).__telegram.visible)).toBe(true)
    await page.getByRole('link', { name: /Математический анализ/ }).click()
    await page.evaluate(() => (window as Window & { Telegram: { WebApp: { BackButton: { trigger(): void } } } }).Telegram.WebApp.BackButton.trigger())
    await expect(page).toHaveURL(/course\/course-1$/)
    await page.goto('/#/course/not-real')
    await expect(page.getByRole('heading', { name: 'Курс не найден' })).toBeVisible()
  })

  test('renders the narrow mobile layout without overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/course/course-1')
    await expect(page.getByRole('heading', { name: 'Курс 1' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('course-mobile.png'), fullPage: true })
  })

  test('keeps a direct admin route closed for a student', async ({ page }) => {
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика недоступна' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Статистика' })).toBeHidden()
  })

  test('renders protected statistics, switches periods and tolerates long names', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: { users: { total: 428, today: 37, days7: 186, days30: 349 }, launches: 94, activity: { searches: 43, materialOpens: 71, yandexDiskOpens: 8 } } }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [{ date: '2026-09-20', users: 2, launches: 4 }, { date: '2026-09-21', users: 37, launches: 94 }] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [{ id: 'mathematical-analysis', count: 99 }] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [{ id: 'Очень длинное название материала которое не должно ломать мобильную вёрстку', count: 17 }] } }))
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByText('428')).toBeVisible()
    await expect(page.getByRole('img', { name: /График/ })).toBeVisible()
    await page.getByRole('button', { name: '7 дней' }).click()
    await expect(page.getByRole('button', { name: '7 дней' })).toHaveClass(/active/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('opens statistics from the administrator home screen', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: { users: { total: 0, today: 0, days7: 0, days30: 0 }, launches: 0, activity: { searches: 0, materialOpens: 0, yandexDiskOpens: 0 } } }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.goto('/#/')
    await page.getByRole('link', { name: 'Статистика' }).click()
    await expect(page).toHaveURL(/#\/admin\/stats$/)
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
  })
})
