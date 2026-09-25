import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

test.describe('Студент ИУ5 critical UI', () => {
  test('starts in Telegram, exposes courses, and has no serious accessibility violations', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('requestfailed', (request) => { if (request.method() === 'GET') consoleErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`) })
    page.on('response', (response) => { if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`) })
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Материалы на Яндекс.Диске' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Курс 1/ })).toBeVisible()
    await expect(page.getByAltText('Логотип Студент ИУ5')).toHaveAttribute('src', '/logo-iu5.jpeg')
    expect(await page.getByAltText('Логотип Студент ИУ5').evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBeTruthy()
    expect(await page.evaluate(async () => {
      await document.fonts.load('16px "ALS Sector"')
      await document.fonts.load('700 16px "ALS Sector"')
      return document.fonts.check('16px "ALS Sector"')
        && document.fonts.check('700 16px "ALS Sector"')
        && getComputedStyle(document.documentElement).fontFamily.includes('-apple-system')
        && getComputedStyle(document.querySelector('.brand')!).fontFamily.includes('ALS Sector')
    })).toBeTruthy()
    const tabBar = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(tabBar).toBeVisible()
    await expect(tabBar.getByRole('link')).toHaveCount(3)
    await expect(tabBar.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
    await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { ready: number } }).__telegram.ready)).toBe(1)
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([])
    expect(consoleErrors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
  })

  test('opens the third course from its nested Yandex share and navigates semester folders', async ({ page }) => {
    await page.goto('/#/')
    await page.getByRole('link', { name: /Курс 3/ }).click()
    await expect(page).toHaveURL(/#\/course\/course-3$/)
    await expect(page.getByRole('heading', { name: 'Курс 3' })).toBeVisible()
    await expect(page.getByRole('link', { name: /5\s*семестр/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /6\s*семестр/ })).toBeVisible()
    await page.getByRole('link', { name: /5\s*семестр/ }).click()
    await expect(page.getByRole('link', { name: /ОАД/ })).toBeVisible()
    await page.getByRole('link', { name: /ОАД/ }).click()
    await expect(page.getByRole('link', { name: /нирс/ })).toBeVisible()
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
    for (const route of ['/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80']) {
      await page.goto(route)
      await expect(page.getByRole('button', { name: 'Скачать Лекция 1.pdf' })).toBeVisible()
      expect(await page.locator('.disk-file').evaluateAll((cards) => {
        const edges = cards.map((card) => {
          const cardBox = card.getBoundingClientRect()
          const buttonBox = card.querySelector<HTMLButtonElement>('.download-button')!.getBoundingClientRect()
          return cardBox.right - buttonBox.right
        })
        return edges.every((inset) => Math.abs(inset - edges[0]) < 1)
      })).toBeTruthy()
    }
  })

  test('uses two-column semester tiles for Russian names without breaking words', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/#/course/course-1?path=1%20%D0%A1%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
      const tiles = page.locator('.semester-subject-grid .disk-item--folder')
      await expect(tiles).toHaveCount(3)
      const geometry = await tiles.evaluateAll((items) => {
        const [first, second] = items.map((item) => item.getBoundingClientRect())
        const titles = items.map((item) => {
          const title = item.querySelector<HTMLElement>('strong')!
          const style = getComputedStyle(title)
          return { name: title.textContent, scrollWidth: title.scrollWidth, clientWidth: title.clientWidth, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak }
        })
        return { sameRow: first.top === second.top && first.left < second.left, titles }
      })
      expect(geometry.sameRow).toBeTruthy()
      for (const title of geometry.titles) {
        expect(title.scrollWidth, title.name ?? '').toBeLessThanOrEqual(title.clientWidth)
        expect(title.overflowWrap).toBe('normal')
        expect(title.wordBreak).toBe('normal')
      }
    }
  })

  test('renders a semester file as a full-width download card', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/#/course/course-1?path=1%20%D0%A1%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
      const file = page.locator('.semester-subject-grid .disk-file')
      await expect(file).toHaveCount(1)
      expect(await file.evaluate((card) => {
        const grid = card.parentElement!.getBoundingClientRect()
        const box = card.getBoundingClientRect()
        const title = card.querySelector<HTMLElement>('strong')!
        const download = card.querySelector<HTMLElement>('.download-button')!
        return Math.abs(box.left - grid.left) < 1
          && Math.abs(box.right - grid.right) < 1
          && title.scrollWidth <= title.clientWidth
          && download.getBoundingClientRect().right <= box.right
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
    await expect(page.getByRole('link', { name: 'К корню курса' })).toHaveCount(0)
    await page.getByRole('button', { name: '← Назад' }).click()
    await expect(page.getByRole('heading', { name: 'Студент ИУ5' })).toBeVisible()
    await expect(page.getByText('Каталог пока недоступен')).toBeHidden()
  })

  test('suggests from one character and opens a case-insensitive teacher match directly', async ({ page }) => {
    await page.goto('/#/search')
    const input = page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' })
    await input.fill('г')
    const hints = page.getByLabel('Подсказки поиска')
    await expect(hints).toContainText('Аналитическая геометрия')
    await expect(hints.getByRole('button').first().locator('strong')).toHaveText('Аналитическая геометрия')
    await expect(hints.getByRole('button').first().locator('small')).toHaveText('1 course / 1 Семестр')
    await input.fill('ГРИБ')
    const suggestion = page.getByLabel('Подсказки поиска').getByRole('button', { name: /Аналитическая геометрия/ })
    await expect(suggestion).toBeVisible()
    await suggestion.click()
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('path'))).toBe('/1 Семестр/Аналитическая геометрия')
    await expect(page.getByText(/^Папка:/)).toContainText('Аналитическая геометрия')
    await expect(page.getByRole('button', { name: 'Конспект.pdf Скачать файл' })).toBeVisible()
  })

  test('full search uses only tagged folders with case-insensitive prefixes', async ({ page }) => {
    await page.goto('/#/search?q=%D0%93%D0%A0%D0%98%D0%91')
    await expect(page.getByText('Найдено папок: 2')).toBeVisible()
    const result = page.getByRole('link', { name: /Аналитическая геометрия/ })
    await expect(result).toBeVisible()
    await expect(result.locator('strong')).toHaveText('Аналитическая геометрия')
    await expect(result.locator('small')).toHaveText('1 course / 1 Семестр')
    await page.goto('/#/search?q=%D1%84%D0%B8%D0%B7%D0%B8%D0%BA%D0%B0')
    const physicsResults = page.getByRole('link', { name: /Физика/ })
    await expect(physicsResults).toHaveCount(2)
    await expect(physicsResults.nth(0).locator('small')).toHaveText('1 course / 2 Семестр')
    await expect(physicsResults.nth(1).locator('small')).toHaveText('2 course / 3 sem')
    await page.goto('/#/search?q=%D0%BD%D0%B5%D1%81%D1%83%D1%89%D0%B5%D1%81%D1%82%D0%B2%D1%83%D1%8E%D1%89%D0%B8%D0%B9')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
  })

  test('keeps search suggestions tappable after opening Search from the bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    await expect(page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Поиск' }).click()
    await page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' }).fill('м')
    const suggestion = page.getByLabel('Подсказки поиска').getByRole('button', { name: /Математичес/ })
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
    await expect(page.getByRole('link', { name: /Курс 1/ })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBeTruthy()
    await page.evaluate(() => window.scrollTo(0, 100))
    await expect.poll(() => page.evaluate(() => scrollY > 0)).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollX === 0)).toBeTruthy()
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
    const cardMetrics = await page.locator('.semester-button-grid .favorite-card').evaluateAll((cards) => cards.map((card) => {
      const box = card.getBoundingClientRect()
      const title = card.querySelector('strong')
      return { text: title?.textContent, left: box.left, right: box.right, clientWidth: card.clientWidth, scrollWidth: card.scrollWidth, titleClientWidth: title?.clientWidth ?? 0, titleScrollWidth: title?.scrollWidth ?? 0 }
    }))
    expect(cardMetrics.filter(({ left, right, clientWidth, scrollWidth, titleClientWidth, titleScrollWidth }) => left < 0 || right > 320 || scrollWidth > clientWidth + 1 || titleScrollWidth > titleClientWidth + 1), JSON.stringify(cardMetrics)).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('course-mobile.png'), fullPage: true })
  })

  test('keeps a direct admin route closed for a student', async ({ page }) => {
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика недоступна' })).toBeVisible()
    await expect(page.locator('header').getByRole('link', { name: 'Статистика' })).toHaveCount(0)
  })

  test('renders protected statistics, switches periods and tolerates long names', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: { users: { total: 428, today: 37, days7: 186, days30: 349 }, launches: 94, activity: { searches: 43, materialOpens: 71, yandexDiskOpens: 8 } } }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [{ date: '2026-09-20', users: 2, launches: 4 }, { date: '2026-09-21', users: 37, launches: 94 }] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [{ id: 'mathematical-analysis', count: 99 }] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [{ id: 'Очень длинное название материала которое не должно ломать мобильную вёрстку', count: 17 }] } }))
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link')).toHaveCount(3)
    await expect(page.locator('header').getByRole('link', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByText('428')).toBeVisible()
    await expect(page.getByRole('img', { name: /График/ })).toBeVisible()
    await page.setViewportSize({ width: 320, height: 568 })
    expect(await page.evaluate(() => {
      const controls = [document.querySelector('.brand'), ...document.querySelectorAll('header nav a')].filter((node): node is Element => node instanceof Element)
      const boxes = controls.map((node) => node.getBoundingClientRect())
      return document.documentElement.scrollWidth <= innerWidth
        && boxes.every((a, index) => boxes.slice(index + 1).every((b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))
    })).toBeTruthy()
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
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav.getByRole('link')).toHaveCount(3)
    await expect(nav.getByRole('link', { name: 'Статистика' })).toHaveCount(0)
    await page.locator('header').getByRole('link', { name: 'Статистика' }).click()
    await expect(page).toHaveURL(/#\/admin\/stats$/)
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
  })
})
