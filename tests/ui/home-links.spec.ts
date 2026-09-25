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

test('fits the complete home screen without page or main scrolling on Telegram phones', async ({ page }, testInfo) => {
  for (const [width, height] of [[295, 667], [320, 568], [375, 667], [390, 720], [390, 730], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/#/')
    await page.evaluate((viewportHeight) => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; contentSafeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = viewportHeight
      app.viewportStableHeight = viewportHeight
      app.contentSafeAreaInset = { top: 24, right: 0, bottom: 24, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
    }, height)
    await expect(page.locator('.course-grid a')).toHaveCount(3)
    const metrics = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON()
      return {
        html: document.documentElement.scrollHeight,
        body: document.body.scrollHeight,
        width: document.documentElement.scrollWidth,
        main: main.scrollHeight,
        mainClient: main.clientHeight,
        header: box('header'), greeting: box('.user-greeting'), content: box('main'), hero: box('.hero'), courses: box('.home-courses'), links: box('.home-links'), footer: box('footer'), nav: box('.bottom-nav'),
        cards: [...document.querySelectorAll('.course-grid a')].map((card) => ({ box: card.getBoundingClientRect().toJSON(), scroll: card.scrollHeight, client: card.clientHeight })),
      }
    })
    expect(metrics.html, `${width}×${height} document`).toBeLessThanOrEqual(height + 1)
    expect(metrics.body, `${width}×${height} body`).toBeLessThanOrEqual(height + 1)
    expect(metrics.width, `${width}×${height} horizontal`).toBeLessThanOrEqual(width)
    expect(metrics.main, `${width}×${height} main`).toBeLessThanOrEqual(metrics.mainClient + 1)
    expect(metrics.greeting.top).toBeGreaterThanOrEqual(metrics.header.bottom)
    expect(metrics.hero.top).toBeGreaterThanOrEqual(metrics.greeting.bottom)
    expect(metrics.header.top).toBeGreaterThanOrEqual(24)
    expect(metrics.links.bottom).toBeLessThanOrEqual(metrics.content.bottom + 1)
    expect(metrics.footer.top).toBeGreaterThanOrEqual(metrics.links.bottom)
    expect(metrics.footer.bottom).toBeLessThanOrEqual(metrics.nav.top - 4)
    expect(metrics.nav.bottom).toBeLessThanOrEqual(height - 24)
    expect(metrics.cards.every((card) => card.box.top >= metrics.content.top && card.box.bottom <= metrics.content.bottom + 1 && card.scroll <= card.client + 1)).toBe(true)
    await page.locator('main').evaluate((element) => element.scrollTo(0, 100))
    await page.evaluate(() => window.scrollTo(0, 100))
    expect(await page.evaluate(() => ({ page: scrollY, main: document.querySelector('main')!.scrollTop, body: document.body.scrollTop }))).toEqual({ page: 0, main: 0, body: 0 })
    await page.screenshot({ path: testInfo.outputPath(`home-${width}x${height}.png`) })
  }
})
