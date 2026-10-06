import { expect, test } from './fixtures'

const summary = { users: { total: 2, today: 1, days7: 2, days30: 2 }, launches: 5, activity: { searches: 0, materialOpens: 0, yandexDiskOpens: 0 } }

async function mockDashboard(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
  await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: summary }))
  await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
  await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
}

test.describe('admin analytics users', () => {
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
    expect(await table.getByRole('columnheader').evaluateAll((headers) => headers.map((header) => header.querySelector('button')?.textContent?.replace(/[↕↑↓]/g, '').trim()))).toEqual(['Пользователь', 'Запуски', 'Первый вход', 'Последняя активность'])
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

  test('collapses the user list while keeping its four summary metrics visible', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [{ username: 'ivanov', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 2 }], nextOffset: null } }))
    await page.goto('/#/admin/stats')
    const section = page.locator('details.stats-users-disclosure')
    const disclosure = section.getByText('Список пользователей', { exact: true })
    const metrics = page.locator('.stats-page > .stats-grid .stats-card')
    await expect(metrics).toHaveCount(4)
    await expect(metrics).toHaveText(['Всего2', 'Сегодня1', '7 дней2', '30 дней2'])
    expect(await section.locator('summary').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await expect(section).toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeVisible()
    await expect(section.getByLabel('Поиск по username')).toBeVisible()
    await disclosure.click()
    await expect(section).not.toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeHidden()
    await expect(section.getByLabel('Поиск по username')).toBeHidden()
    await expect(metrics).toHaveText(['Всего2', 'Сегодня1', '7 дней2', '30 дней2'])
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

  test('keeps dashboard visible when the users endpoint fails', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ status: 500, json: { error: 'temporary' } }))
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByText('Не удалось загрузить список пользователей.')).toBeVisible()
    await expect(page.getByText('Запуски', { exact: true })).toBeVisible()
  })
})
