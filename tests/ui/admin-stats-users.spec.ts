import { expect, test } from './fixtures'

const summary = { users: { total: 2, today: 1, days7: 2, days30: 2 }, launches: 5, activity: { searches: 0, materialOpens: 0, yandexDiskOpens: 0 } }

test.describe('admin analytics users', () => {
  test('shows labels, launch counts and dates in responsive rows', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: summary }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ json: { items: [
      { username: 'ivanov', firstSeenAt: Math.floor(Date.now() / 1000) - 86400, lastSeenAt: Math.floor(Date.now() / 1000), launchCount: 18 },
      { username: null, firstSeenAt: Math.floor(Date.now() / 1000) - 172800, lastSeenAt: Math.floor(Date.now() / 1000), launchCount: 3 },
    ], nextOffset: null } }))

    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/admin/stats')
    await expect(page.getByText('@ivanov')).toBeVisible()
    await expect(page.getByText('Без username')).toBeVisible()
    await expect(page.locator('.stats-user').first()).toContainText('18')
    await expect(page.locator('.stats-user').first()).toContainText('Сегодня')
    await expect(page.locator('.stats-user').first()).toContainText('Вчера')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('reloads the selected period and appends the next page', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: summary }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
    const requests: string[] = []
    await page.route('**/api/admin/stats/users?*', (route) => {
      const url = new URL(route.request().url())
      requests.push(`${url.searchParams.get('period')}:${url.searchParams.get('offset')}`)
      const offset = Number(url.searchParams.get('offset'))
      return route.fulfill({ json: { items: [{ username: offset ? 'second' : 'first', firstSeenAt: 1791262800, lastSeenAt: 1791262800, launchCount: 1 }], nextOffset: offset ? null : 50 } })
    })

    await page.goto('/#/admin/stats')
    await expect(page.getByText('@first')).toBeVisible()
    await page.getByRole('button', { name: 'Показать ещё' }).click()
    await expect(page.getByText('@second')).toBeVisible()
    await page.getByRole('button', { name: '7 дней' }).click()
    await expect(page.getByText('@first')).toBeVisible()
    await expect.poll(() => requests).toContain('7d:0')
    expect(requests).toContain('30d:0')
    expect(requests).toContain('30d:50')
  })

  test('keeps dashboard visible when the users endpoint fails', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.route('**/api/admin/stats/summary?period=*', (route) => route.fulfill({ json: summary }))
    await page.route('**/api/admin/stats/activity?period=*', (route) => route.fulfill({ json: { days: [] } }))
    await page.route('**/api/admin/stats/subjects?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/materials?period=*', (route) => route.fulfill({ json: { items: [] } }))
    await page.route('**/api/admin/stats/users?*', (route) => route.fulfill({ status: 500, json: { error: 'temporary' } }))
    await page.goto('/#/admin/stats')
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
    await expect(page.getByText('Не удалось загрузить список пользователей.')).toBeVisible()
    await expect(page.getByText('Запуски', { exact: true })).toBeVisible()
  })
})
