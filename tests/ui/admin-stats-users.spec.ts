import { expect, test } from './fixtures'

const summaries = {
  today: { users: { total: 100, today: 11, days7: 21, days30: 31 }, launches: 5, activity: { searches: 1, materialOpens: 2, yandexDiskOpens: 3 } },
  '7d': { users: { total: 100, today: 12, days7: 22, days30: 32 }, launches: 6, activity: { searches: 2, materialOpens: 3, yandexDiskOpens: 4 } },
  '30d': { users: { total: 100, today: 13, days7: 23, days30: 33 }, launches: 7, activity: { searches: 3, materialOpens: 4, yandexDiskOpens: 5 } },
  all: { users: { total: 100, today: 14, days7: 24, days30: 34 }, launches: 8, activity: { searches: 4, materialOpens: 5, yandexDiskOpens: 6 } },
}

async function mockDashboard(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
  await page.route('**/api/admin/stats/summary?period=*', (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') as keyof typeof summaries | null
    return route.fulfill({ json: summaries[period ?? '30d'] })
  })
  await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
  await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
}

test.describe('admin analytics users', () => {
  test('AdminStats has a clean viewport matrix in both themes', async ({ page }, testInfo) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [
      { username: 'abcdefghijklmnopqrstuvwx12345678', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 18 },
      { username: null, firstSeenAt: 1791176400, lastSeenAt: 1791176400, launchCount: 3 },
    ], nextOffset: null } }))
    await page.setViewportSize({ width: 320, height: 760 })
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('table', { name: 'Пользователи в статистике' })).toBeVisible()
    const metrics = page.locator('.stats-page > .stats-grid .stats-card')
    await expect(metrics).toHaveCount(2)
    await expect(metrics).toHaveText(['Всего100', '30 дней33'])
    const measurements: Array<{ theme: string; width: number; overflow: number; overlap: boolean; launchHeaderLines: number; headerOverflow: string[] }> = []
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((colorScheme) => {
        const app = (window as Window & { Telegram: { WebApp: { colorScheme: string; themeParams: Record<string, string> } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
        app.colorScheme = colorScheme
        app.themeParams = colorScheme === 'dark'
          ? { bg_color: '#101820', text_color: '#f4f7fa', secondary_bg_color: '#182633', button_color: '#78b4ff', button_text_color: '#102333' }
          : { bg_color: '#f6faff', text_color: '#1a1a19', secondary_bg_color: '#e1effb', button_color: '#006cdc', button_text_color: '#ffffff' }
        ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('themeChanged')
      }, theme)
      for (const width of [320, 360, 375, 390, 428, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: width < 600 ? 760 : 900 })
        await page.waitForTimeout(20)
        const result = await page.evaluate(() => {
          const rect = (selector: string) => {
            const element = document.querySelector(selector)
            return element ? element.getBoundingClientRect() : null
          }
          const blocks = [...document.querySelectorAll('.stats-page > *')].filter((element) => getComputedStyle(element).display !== 'none')
          const boxes = blocks.map((element) => element.getBoundingClientRect())
          const overlap = boxes.slice(1).some((box, index) => box.top < boxes[index].bottom - 1)
          const table = document.querySelector('.stats-users-table')!
          const headers = [...table.querySelectorAll('thead th')]
          const launchLabel = headers[1].querySelector('.stats-sort-label')!
          const range = document.createRange()
          range.selectNodeContents(launchLabel)
          const launchHeaderLines = range.getClientRects().length
          const headerOverflow = headers.flatMap((header) => {
            const button = header.querySelector('button')!
            const label = header.querySelector('.stats-sort-label')!
            const bounds = label.getBoundingClientRect(), column = header.getBoundingClientRect()
            return button.scrollWidth > button.clientWidth + 1 || bounds.right > column.right + 1 || bounds.left < column.left - 1
              ? [`${label.textContent}: button=${button.clientWidth}/${button.scrollWidth}, label=${bounds.left.toFixed(1)}..${bounds.right.toFixed(1)}, column=${column.left.toFixed(1)}..${column.right.toFixed(1)}`]
              : []
          })
          const period = rect('.stats-periods')!, metrics = rect('.stats-page > .stats-grid')!
          const periodCardOverlap = period.bottom > metrics.top + 1
          return { overflow: document.documentElement.scrollWidth - innerWidth, overlap: overlap || periodCardOverlap, launchHeaderLines, headerOverflow }
        })
        measurements.push({ theme, width, ...result })
        if (width === 320) await page.screenshot({ path: testInfo.outputPath(`admin-stats-${theme}-320.png`), fullPage: true })
      }
    }
    expect(measurements.filter(({ overflow, overlap, launchHeaderLines, headerOverflow }) => overflow > 0 || overlap || launchHeaderLines !== 1 || headerOverflow.length), JSON.stringify(measurements)).toEqual([])
  })

  test('shows a semantic table with labels, counts and dates without mobile overflow', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [
      { username: 'ivanov', firstSeenAt: Math.floor(Date.now() / 1000) - 86400, lastSeenAt: Math.floor(Date.now() / 1000), launchCount: 18 },
      { username: null, firstSeenAt: Math.floor(Date.now() / 1000) - 172800, lastSeenAt: Math.floor(Date.now() / 1000), launchCount: 3 },
    ], nextOffset: null } }))

    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/admin/stats')
    const table = page.getByRole('table', { name: 'Пользователи в статистике' })
    expect(await table.evaluate((element) => getComputedStyle(element).display)).toBe('table')
    expect(await table.getByRole('columnheader').evaluateAll((headers) => headers.map((header) => header.querySelector('.stats-sort-label')?.textContent?.trim()))).toEqual(['Пользователь', 'Запуски', 'Первый вход', 'Последняя активность'])
    await expect(table.getByText('@ivanov')).toBeVisible()
    await expect(table.getByText('Без username')).toBeVisible()
    await expect(table.locator('tbody tr').first()).toContainText('18')
    await expect(table.locator('tbody tr').first()).toContainText('Сегодня')
    await expect(table.locator('tbody tr').first()).toContainText('Вчера')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
    await expect(page.locator('.stats-users-filter-row')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('sorts each column both ways on the server and preserves search/sort through pagination', async ({ page }) => {
    await mockDashboard(page)
    const requests: URL[] = []
    await page.route('**/api/admin/stats/users?*', (route) => {
      const url = new URL(route.request().url())
      requests.push(url)
      const offset = Number(url.searchParams.get('offset'))
      return route.fulfill({ json: { items: [{ username: offset ? 'ivanov_two' : 'ivanov_one', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 7 }], nextOffset: offset ? null : 50 } })
    })

    await page.goto('/#/admin/stats')
    await expect(page.getByText('@ivanov_one')).toBeVisible()
    const table = page.getByRole('table', { name: 'Пользователи в статистике' })
    const header = (name: string) => table.getByRole('columnheader', { name: new RegExp(name) }).getByRole('button')
    await expect.poll(() => requests[0]?.searchParams.get('sortBy')).toBe('lastSeenAt')
    await expect.poll(() => requests[0]?.searchParams.get('sortDirection')).toBe('desc')
    const sortHeaders = [
      ['Последняя активность', 'lastSeenAt', 'asc', 'desc'],
      ['Пользователь', 'username', 'asc', 'desc'],
      ['Запуски', 'launchCount', 'asc', 'desc'],
      ['Первый вход', 'firstSeenAt', 'asc', 'desc'],
    ] as const
    for (const [label, by, firstDirection, secondDirection] of sortHeaders) {
      await header(label).click()
      await expect.poll(() => requests.at(-1)?.searchParams.get('sortBy')).toBe(by)
      await expect.poll(() => requests.at(-1)?.searchParams.get('sortDirection')).toBe(firstDirection)
      await expect(table.getByRole('columnheader', { name: new RegExp(label) })).toHaveAttribute('aria-sort', firstDirection === 'asc' ? 'ascending' : 'descending')
      await header(label).click()
      await expect.poll(() => requests.at(-1)?.searchParams.get('sortDirection')).toBe(secondDirection)
    }
    await page.getByLabel('Поиск по username').fill('ivanov')
    await page.getByRole('button', { name: 'Найти' }).click()
    await expect.poll(() => requests.at(-1)?.searchParams.get('username')).toBe('ivanov')
    const filteredAndSorted = requests.at(-1)
    expect(filteredAndSorted?.searchParams.get('sortBy')).toBe('firstSeenAt')
    expect(filteredAndSorted?.searchParams.get('sortDirection')).toBe('desc')
    expect(filteredAndSorted?.searchParams.get('offset')).toBe('0')
    await page.getByRole('button', { name: 'Показать ещё' }).click()
    await expect(page.getByText('@ivanov_two')).toBeVisible()
    const nextPage = requests.at(-1)
    for (const key of ['username', 'sortBy', 'sortDirection']) expect(nextPage?.searchParams.get(key)).toBe(filteredAndSorted?.searchParams.get(key))
    expect(nextPage?.searchParams.get('offset')).toBe('50')
    expect(nextPage?.searchParams.get('period')).toBe('30d')
  })

  test('collapses the user list while keeping both summary metrics visible', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [{ username: 'ivanov', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 2 }], nextOffset: null } }))
    await page.goto('/#/admin/stats')
    const section = page.locator('details.stats-users-disclosure')
    const disclosure = section.getByText('Список пользователей', { exact: true })
    const metrics = page.locator('.stats-page > .stats-grid .stats-card')
    await expect(metrics).toHaveCount(2)
    await expect(metrics).toHaveText(['Всего100', '30 дней33'])
    expect(await section.locator('summary').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await expect(section).toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeVisible()
    await expect(section.getByLabel('Поиск по username')).toBeVisible()
    await disclosure.click()
    await expect(section).not.toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeHidden()
    await expect(section.getByLabel('Поиск по username')).toBeHidden()
    await expect(metrics).toHaveText(['Всего100', '30 дней33'])
    await disclosure.click()
    await expect(section).toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeVisible()
  })

  test('reloads users for a changed period', async ({ page }) => {
    await mockDashboard(page)
    const requests: string[] = []
    await page.route('**/api/admin/stats/users?*', (route) => {
      const url = new URL(route.request().url())
      requests.push(`${url.searchParams.get('period')}:${url.searchParams.get('offset')}`)
      return route.fulfill({ json: { items: [{ username: 'period_user', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 1 }], nextOffset: null } })
    })
    await page.goto('/#/admin/stats')
    await expect(page.getByText('@period_user')).toBeVisible()
    await page.getByRole('button', { name: '7 дней' }).click()
    await expect.poll(() => requests).toContain('7d:0')
  })

  test('shows the period-specific user metric for all four periods', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [], nextOffset: null } }))
    const summaryPeriods: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/admin/stats/summary') summaryPeriods.push(url.searchParams.get('period') ?? '')
    })
    await page.goto('/#/admin/stats')
    const cards = page.locator('.stats-page > .stats-grid .stats-card')
    await expect(cards).toHaveCount(2)
    const expected = [
      ['Сегодня', 'Всего100', 'Сегодня11'],
      ['7 дней', 'Всего100', '7 дней22'],
      ['30 дней', 'Всего100', '30 дней33'],
      ['Всё время', 'Всего100', 'Всё время100'],
    ] as const
    for (const [periodLabel, totalText, periodText] of expected) {
      await page.getByRole('button', { name: periodLabel, exact: true }).click()
      const expectedPeriod = ({ Сегодня: 'today', '7 дней': '7d', '30 дней': '30d', 'Всё время': 'all' } as const)[periodLabel]
      await expect.poll(() => summaryPeriods).toContain(expectedPeriod)
      await expect(cards).toHaveText([totalText, periodText])
    }
  })

  test('keeps dashboard visible when the users endpoint fails', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ status: 500, json: { error: 'temporary' } }))
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByText('Не удалось загрузить список пользователей.')).toBeVisible()
    await expect(page.getByText('Запуски', { exact: true })).toBeVisible()
  })
})
