import { test, expect } from './fixtures'

test('shows the beta marker only for beta builds and keeps it readable at 320px in both themes', async ({ page }) => {
  const isBeta = process.env.VITE_APP_ENV === 'beta'
  await page.setViewportSize({ width: 320, height: 700 })

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.goto('/#/')
    const badge = page.locator('.environment-badge')
    if (isBeta) {
      await expect(badge).toHaveText('BETA')
      await expect(badge).toBeVisible()
      const badgeColors = await badge.evaluate((element) => {
        const style = getComputedStyle(element)
        return { color: style.color, background: style.backgroundColor }
      })
      expect(badgeColors.color).not.toBe('rgba(0, 0, 0, 0)')
      expect(badgeColors.background).not.toBe('rgba(0, 0, 0, 0)')
    } else {
      await expect(badge).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
})
