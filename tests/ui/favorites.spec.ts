import { test, expect } from './fixtures'

test('saves folders and files without opening them, restores them after reload, and removes them', async ({ page }) => {
  await page.goto('/#/course/course-1')
  const semester = page.locator('.favorite-card').filter({ hasText: 'семестр' }).first()
  await semester.getByRole('button', { name: /Добавить в избранное/ }).click()
  await expect(page).toHaveURL(/#\/course\/course-1$/)
  await expect(semester.getByRole('button', { name: /Удалить из избранного/ })).toBeVisible()

  await semester.getByRole('link').click()
  const file = page.locator('.disk-file').filter({ hasText: 'Лекция 1.pdf' })
  await file.getByRole('button', { name: /Добавить в избранное/ }).click()
  await expect(page).toHaveURL(/#\/course\/course-1\?path=/)
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Профиль' }).click()
  await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Папки' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Файлы' })).toBeVisible()
  await expect(page.locator('.profile-item')).toHaveCount(2)

  await page.reload()
  await expect(page.locator('.profile-item')).toHaveCount(2)
  await page.locator('.profile-item').filter({ hasText: 'Лекция 1.pdf' }).getByRole('button', { name: /Удалить из избранного/ }).click()
  await expect(page.locator('.profile-item')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.profile-item')).toHaveCount(1)
  await page.locator('.profile-item').getByRole('button', { name: /Удалить из избранного/ }).click()
  await expect(page.getByRole('heading', { name: 'В избранном пока ничего нет' })).toBeVisible()
})

test('keeps four administrator tabs and their slider within a 320px viewport', async ({ page }) => {
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/#/profile')
  const nav = page.getByRole('navigation', { name: 'Основная навигация' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  for (const link of await nav.getByRole('link').all()) {
    const box = await link.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  const bounds = await nav.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  await expect(nav.getByRole('link', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page')
})

test('rolls back a failed favorite write and leaves catalog controls usable', async ({ page }) => {
  await page.route('**/api/profile/favorites', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fulfill({ status: 503, json: { error: 'Unavailable' } })
  })
  await page.goto('/#/course/course-1')
  const folder = page.locator('.favorite-card').filter({ hasText: 'семестр' }).first()
  await folder.getByRole('button', { name: /Добавить в избранное/ }).click()
  await expect(folder.getByRole('button', { name: /Удалить из избранного/ })).toBeVisible()
  await expect(folder.getByRole('button', { name: /Добавить в избранное/ })).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить избранное')
  await folder.getByRole('link').click()
  await expect(page).toHaveURL(/#\/course\/course-1\?path=/)
})

test('offers removal when a saved file is gone from Yandex Disk', async ({ page }) => {
  await page.goto('/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
  const file = page.locator('.disk-file').filter({ hasText: 'Лекция 1.pdf' })
  await file.getByRole('button', { name: /Добавить в избранное/ }).click()
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Профиль' }).click()
  await page.route('https://cloud-api.yandex.net/v1/disk/public/resources/download?**', (route) => route.fulfill({ status: 404, json: { message: 'not found' } }))
  await page.locator('.profile-item').getByRole('button', { name: 'Лекция 1.pdf', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('был перемещён или удалён')
  await page.locator('.profile-item').getByRole('button', { name: /Удалить из избранного/ }).click()
  await expect(page.getByRole('heading', { name: 'В избранном пока ничего нет' })).toBeVisible()
})
