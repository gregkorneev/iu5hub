import { test, expect } from './fixtures'

test.describe('persistent bottom navigation', () => {
  test('keeps Catalog and Search contexts while preserving search-result provenance and BackButton', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: false } }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav.getByRole('link')).toHaveCount(4)
    await expect(nav.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('link', { name: /Курс 1/ }).click()
    await expect(nav.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', { name: /1 семестр/ }).click()
    const touchBar = page.locator('.bottom-touch-bar')
    await expect(touchBar.getByRole('button', { name: '← Назад' })).toBeVisible()
    await expect(touchBar.getByRole('link', { name: 'К корню курса' })).toHaveCount(0)
    await expect(page.locator('main .in-app-back')).toHaveCount(0)
    await expect(touchBar).toHaveCSS('position', 'fixed')
    await page.setViewportSize({ width: 320, height: 844 })
    const touchBarBounds = await touchBar.boundingBox()
    const backBounds = await touchBar.getByRole('button', { name: '← Назад' }).boundingBox()
    const navBounds = await nav.boundingBox()
    expect(touchBarBounds && backBounds).toBeTruthy()
    expect(navBounds).toBeTruthy()
    expect(touchBarBounds!.x).toBeGreaterThanOrEqual(0)
    expect(touchBarBounds!.x + touchBarBounds!.width).toBeLessThanOrEqual(320)
    expect(backBounds!.height).toBeGreaterThanOrEqual(44)
    expect(backBounds!.width).toBeCloseTo(navBounds!.width, 0)
    expect(backBounds!.x + backBounds!.width / 2).toBeCloseTo(touchBarBounds!.x + touchBarBounds!.width / 2, 0)
    await touchBar.getByRole('button', { name: '← Назад' }).click()
    await expect(page).toHaveURL(/#\/course\/course-1$/)
    await expect(touchBar.getByRole('link', { name: 'К корню курса' })).toHaveCount(0)
    await page.getByRole('link', { name: /1 семестр/ }).click()
    await nav.getByRole('link', { name: 'Поиск' }).click()
    const searchInput = page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' })
    await expect(searchInput).toBeFocused()
    await searchInput.fill('ГРИБ')
    await searchInput.press('Enter')
    const searchPath = new URL(page.url()).hash
    await page.getByRole('link', { name: 'Аналитическая геометрия' }).click()
    await expect(nav.getByRole('link', { name: 'Поиск' })).toHaveAttribute('aria-current', 'page')
    await expect(touchBar.getByRole('link', { name: 'К корню курса' })).toHaveCount(0)
    await expect(touchBar.getByRole('button', { name: '← Назад' })).toBeVisible()

    await page.evaluate(() => (window as Window & { Telegram: { WebApp: { BackButton: { trigger(): void } } } }).Telegram.WebApp.BackButton.trigger())
    await expect.poll(() => new URL(page.url()).hash).toBe(searchPath)

    await nav.getByRole('link', { name: 'Каталог' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole('heading', { name: 'Студент ИУ5' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')

    await nav.getByRole('link', { name: 'Поиск' }).click()
    expect(new URL(page.url()).hash).toBe(searchPath)
    await expect(searchInput).toBeFocused()
    await searchInput.evaluate((input: HTMLInputElement) => input.blur())
    await nav.getByRole('link', { name: 'Поиск' }).click()
    await expect(searchInput).toBeFocused()
  })

  test('shows Statistics only for confirmed admins and maps direct routes, unknown paths, and role denial', async ({ page }) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.goto('/#/admin/stats')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav.getByRole('link')).toHaveCount(4)
    await expect(nav.getByRole('link', { name: 'Статистика' })).toHaveCount(0)
    const statistics = page.locator('header').getByRole('link', { name: 'Статистика' })
    await expect(statistics).toBeVisible()
    await expect(statistics).toHaveAttribute('aria-current', 'page')
    await expect(statistics).toHaveCSS('min-height', '44px')
    const adminControls = await page.locator('header .brand, header .admin-stats-link').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))
    expect(adminControls[0].right).toBeLessThanOrEqual(adminControls[1].left)
    await page.setViewportSize({ width: 320, height: 700 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await page.unroute('**/api/admin/me')
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: false } }))
    await page.reload()
    await expect(nav.getByRole('link')).toHaveCount(4)
    await expect(page.locator('header').getByRole('link', { name: 'Статистика' })).toHaveCount(0)
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0)
    await page.goto('/#/unrecognized')
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0)
    await page.goto('/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
    await page.reload()
    await expect(nav.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
    await page.goto('/#/search?q=ГРИБ')
    await expect(nav.getByRole('link', { name: 'Поиск' })).toHaveAttribute('aria-current', 'page')
  })

  test('keeps the bar in the safe area and preserves touch targets at narrow and keyboard-like heights', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/#/search')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const geometry = await nav.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const links = [...element.querySelectorAll('a')].map((link) => link.getBoundingClientRect())
      return { bottom: box.bottom, right: box.right, widths: links.map((link) => link.width), heights: links.map((link) => link.height), viewport: innerWidth }
    })
    expect(geometry.bottom).toBeLessThanOrEqual(844)
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport)
    expect(geometry.widths.every((width) => width >= 44)).toBe(true)
    expect(geometry.heights.every((height) => height >= 44)).toBe(true)
    const shape = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.bottom-nav')!
      const indicator = getComputedStyle(nav, '::before')
      const navBox = nav.getBoundingClientRect()
      return {
        barRadius: getComputedStyle(nav).borderRadius,
        barHeight: navBox.height,
        barWidth: navBox.width,
        horizontalPadding: getComputedStyle(nav).paddingInlineStart,
        indicatorRadius: indicator.borderRadius,
        indicatorTop: Number.parseFloat(indicator.top),
        indicatorBottom: Number.parseFloat(indicator.bottom),
        indicatorHeight: navBox.height - Number.parseFloat(indicator.top) - Number.parseFloat(indicator.bottom),
        targetHeight: nav.querySelector('a')!.getBoundingClientRect().height,
      }
    })
    expect(shape.barRadius).toBe('999px')
    expect(shape.barHeight / shape.barWidth).toBeLessThan(0.25)
    expect(shape.horizontalPadding).toBe('6px')
    expect(shape.indicatorRadius).toBe('999px')
    expect(shape.indicatorTop).toBe(shape.indicatorBottom)
    expect(shape.indicatorHeight).toBeLessThan(shape.targetHeight)
    expect(shape.indicatorHeight).toBeGreaterThanOrEqual(34)

    await page.setViewportSize({ width: 390, height: 500 })
    await page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' }).focus()
    await expect(nav).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('captures root, nested Catalog, Search, admin and scrolled footer for visual review', async ({ page }, testInfo) => {
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: false } }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    await page.screenshot({ path: testInfo.outputPath('catalog-root.png'), fullPage: true })
    await page.locator('.bottom-touch-bar').screenshot({ path: testInfo.outputPath('bottom-bar-capsule.png') })
    await page.getByRole('link', { name: /Курс 1/ }).click()
    await page.getByRole('link', { name: /1 семестр/ }).click()
    await page.screenshot({ path: testInfo.outputPath('catalog-nested.png'), fullPage: true })
    await page.locator('nav.bottom-nav').getByRole('link', { name: 'Поиск' }).click()
    await page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' }).fill('ГРИБ')
    await page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' }).press('Enter')
    await page.screenshot({ path: testInfo.outputPath('search-results.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 500 })
    await page.getByRole('searchbox', { name: 'Поиск по тегам и преподавателям' }).focus()
    await page.screenshot({ path: testInfo.outputPath('search-keyboard-like.png'), fullPage: true })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.screenshot({ path: testInfo.outputPath('footer-scrolled.png') })

    await page.unroute('**/api/admin/me')
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }))
    await page.goto('/#/admin/stats')
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link')).toHaveCount(4)
    await expect(page.locator('header').getByRole('link', { name: 'Статистика' })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath('admin-header-action.png') })
    await page.screenshot({ path: testInfo.outputPath('admin-statistics.png'), fullPage: true })
  })
})
