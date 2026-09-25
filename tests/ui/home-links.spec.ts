import { test, expect } from './fixtures'

test('shows the empty Useful Links section below courses on the home screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/')

  const courses = page.locator('.home-courses')
  const usefulLinks = page.getByRole('region', { name: 'Полезные ссылки' })
  await expect(courses).toBeVisible()
  await expect(usefulLinks).toBeVisible()
  await expect(usefulLinks).toContainText('Пока здесь нет ссылок.')

  const coursesBounds = await courses.boundingBox()
  const linksBounds = await usefulLinks.boundingBox()
  expect(coursesBounds && linksBounds).toBeTruthy()
  expect(linksBounds!.y).toBeGreaterThan(coursesBounds!.y + coursesBounds!.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})
