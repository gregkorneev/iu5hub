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
    expect(await table.getByRole('columnheader').evaluateAll((headers) => headers.map((header) => header.querySelector('button')?.textContent?.replace('⌄', '').trim()))).toEqual(['Пользователь', 'Запуски', 'Первый вход', 'Последняя активность'])
    await expect(table.getByText('@ivanov')).toBeVisible()
    await expect(table.getByText('Без username')).toBeVisible()
    await expect(table.locator('tbody tr').first()).toContainText('18')
    await expect(table.locator('tbody tr').first()).toContainText('Сегодня')
    await expect(table.locator('tbody tr').first()).toContainText('Вчера')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
    await table.getByRole('columnheader', { name: /Последняя активность/ }).getByRole('button').click()
    await expect(page.locator('.stats-users-filter-row input')).toHaveAttribute('type', 'date')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('opens one header filter at a time and applies all four server filters through pagination', async ({ page }) => {
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
    const filterInput = page.locator('.stats-users-filter-row input')
    await header('Пользователь').click()
    await filterInput.fill('ivanov')
    await header('Запуски').click()
    await expect(filterInput).toHaveAttribute('type', 'number')
    await expect(page.locator('.stats-users-filter-row')).toHaveCount(1)
    await filterInput.fill('5')
    await page.getByRole('button', { name: 'Применить' }).click()
    await expect(page.getByText('@ivanov_one')).toBeVisible()
    await expect.poll(() => requests.at(-1)?.searchParams.get('minLaunchCount')).toBe('5')
    await header('Пользователь').click()
    await filterInput.fill('ivanov')
    await page.getByRole('button', { name: 'Применить' }).click()
    await header('Первый вход').click()
    await expect(filterInput).toHaveAttribute('type', 'date')
    await filterInput.fill('2026-10-06')
    await page.getByRole('button', { name: 'Применить' }).click()
    await header('Последняя активность').click()
    await filterInput.fill('2026-10-06')
    await page.getByRole('button', { name: 'Применить' }).click()
    const filtered = requests.at(-1)
    expect(filtered?.searchParams.get('username')).toBe('ivanov')
    expect(filtered?.searchParams.get('minLaunchCount')).toBe('5')
    expect(filtered?.searchParams.get('firstSeenOn')).toBe('2026-10-06')
    expect(filtered?.searchParams.get('lastSeenOn')).toBe('2026-10-06')
    expect(filtered?.searchParams.get('offset')).toBe('0')
    await page.getByRole('button', { name: 'Показать ещё' }).click()
    await expect(page.getByText('@ivanov_two')).toBeVisible()
    const nextPage = requests.at(-1)
    for (const key of ['username', 'minLaunchCount', 'firstSeenOn', 'lastSeenOn']) expect(nextPage?.searchParams.get(key)).toBe(filtered?.searchParams.get(key))
    expect(nextPage?.searchParams.get('offset')).toBe('50')
    expect(nextPage?.searchParams.get('period')).toBe('30d')
    await header('Запуски').click()
    await expect(filterInput).toHaveValue('5')
    await page.getByRole('button', { name: 'Сбросить' }).click()
    await expect.poll(() => requests.at(-1)?.searchParams.has('minLaunchCount')).toBe(false)
  })

  test('collapses and expands the full Users section', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [{ username: 'ivanov', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 2 }], nextOffset: null } }))
    await page.goto('/#/admin/stats')
    const section = page.locator('details.stats-users-disclosure')
    const disclosure = section.getByText('Пользователи', { exact: true })
    expect(await section.locator('summary').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await expect(section).toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeVisible()
    await disclosure.click()
    await expect(section).not.toHaveAttribute('open', '')
    await expect(section.getByRole('table')).toBeHidden()
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
