import { test, expect } from './fixtures'
import type { Locator } from '@playwright/test'

async function expectTitleClearOfHeart(title: Locator, heart: Locator) {
  const lines = await title.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return Array.from(range.getClientRects()).map(({ left, right, top, bottom }) => ({ left, right, top, bottom }))
  })
  const button = await heart.boundingBox()
  expect(button).toBeTruthy()
  expect(lines.length).toBeGreaterThan(0)
  expect(lines.some((line) => line.left < button!.x + button!.width && line.right > button!.x && line.top < button!.y + button!.height && line.bottom > button!.y)).toBeFalsy()
}

async function expectFolderTitleBelowIcon(card: Locator) {
  const icon = await card.locator('.disk-item--folder > span').boundingBox()
  const title = await card.locator('.disk-item--folder > strong').boundingBox()
  expect(icon && title).toBeTruthy()
  expect(Math.abs(title!.x - icon!.x)).toBeLessThanOrEqual(4)
  expect(title!.y).toBeGreaterThanOrEqual(icon!.y + icon!.height)
}

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

test('keeps favorite hearts clear of folder and file titles throughout the catalog and profile', async ({ page }, testInfo) => {
  const longRootName = 'Очень длинное название папки для проверки переноса текста на маленьком экране'
  const longSubjectName = 'Парадигмы и конструкции языков программирования'
  const longFileName = 'Практическая работа по программированию РЛ-6.pdf'

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/course/course-1')

    const semester = page.locator('.semester-button-grid .favorite-card').first()
    await expectTitleClearOfHeart(semester.locator('.semester-button strong'), semester.locator('.favorite-button'))

    const rootFolder = page.locator('.favorite-card').filter({ hasText: longRootName })
    await expect(rootFolder).toBeVisible()
    await expectTitleClearOfHeart(rootFolder.locator('.disk-item--folder strong'), rootFolder.locator('.favorite-button'))
    await expectFolderTitleBelowIcon(rootFolder)
    if (width === 320) await rootFolder.getByRole('button', { name: /Добавить в избранное/ }).click()
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('favorites-root-320.png') })

    await page.goto(`/#/course/course-1?path=${encodeURIComponent('1 Семестр')}`)
    const nestedFolder = page.locator('.favorite-card').filter({ hasText: longSubjectName })
    await expect(nestedFolder).toBeVisible()
    await expectTitleClearOfHeart(nestedFolder.locator('.disk-item--folder strong'), nestedFolder.locator('.favorite-button'))
    await expectFolderTitleBelowIcon(nestedFolder)
    const longFile = page.locator('.disk-file').filter({ hasText: longFileName })
    await expect(longFile).toBeVisible()
    await expectTitleClearOfHeart(longFile.locator('.disk-file__open strong'), longFile.locator('.favorite-button'))
    if (width === 320) {
      await nestedFolder.getByRole('button', { name: /Добавить в избранное/ }).click()
      await longFile.getByRole('button', { name: /Добавить в избранное/ }).click()
      await page.screenshot({ path: testInfo.outputPath('favorites-nested-320.png') })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Профиль' }).click()
    for (const item of await page.locator('.profile-item').all()) {
      await expectTitleClearOfHeart(item.locator('.profile-item__content > a, .profile-item__content > button'), item.locator('.favorite-button'))
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('favorites-profile-320.png') })
  }
})

test('keeps four primary tabs and the administrator header action within a 320px viewport', async ({ page }) => {
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/#/profile')
  const nav = page.getByRole('navigation', { name: 'Основная навигация' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  const statistics = page.locator('header').getByRole('link', { name: 'Статистика' })
  await expect(statistics).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Статистика' })).toHaveCount(0)
  const brandBounds = await page.locator('.brand').boundingBox()
  const statsBounds = await statistics.boundingBox()
  expect(brandBounds && statsBounds).toBeTruthy()
  expect(brandBounds!.x + brandBounds!.width).toBeLessThanOrEqual(statsBounds!.x)
  expect(statsBounds!.height).toBeGreaterThanOrEqual(44)
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
