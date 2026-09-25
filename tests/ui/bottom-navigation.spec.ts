import { test, expect } from './fixtures'

test.describe('persistent bottom navigation', () => {
  test('brand logo and text return home from every primary route and a search result', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 720 })
    await page.goto('/#/course/course-1')
    await page.evaluate(() => window.scrollTo(0, 124))
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
    await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Каталог' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    const destinations = [
      'scrolled-course',
      '/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80',
      '/#/schedule',
      '/#/search?q=%D0%93%D0%A0%D0%98%D0%91',
      '/#/profile',
      'search-result',
    ]
    for (const part of ['logo', 'text'] as const) for (const destination of destinations) {
      if (destination === 'scrolled-course') {
        await page.goto('/#/course/course-1')
        await page.evaluate(() => window.scrollTo(0, 124))
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
      } else if (destination === 'search-result') {
        await page.goto('/#/search?q=%D0%93%D0%A0%D0%98%D0%91')
        await page.getByRole('link', { name: 'Аналитическая геометрия' }).click()
        await expect(page).toHaveURL(/#\/course\/course-1/)
      } else await page.goto(destination)
      const brand = page.getByRole('link', { name: 'Студент ИУ5 — главная' })
      await expect(brand).toHaveAttribute('href', '#/')
      const point = await brand.evaluate((link, target) => {
        const logo = link.querySelector('img')!
        const text = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!
        const range = document.createRange()
        range.selectNodeContents(text)
        const box = (target === 'logo' ? logo : range).getBoundingClientRect()
        const x = box.left + box.width / 2
        const y = box.top + box.height / 2
        return { x, y, hitBrand: link.contains(document.elementFromPoint(x, y)), scrollY }
      }, part)
      expect(point.hitBrand, `${part} on ${destination}: ${JSON.stringify(point)}`).toBe(true)
      if (testInfo.project.name === 'chromium') await page.mouse.click(point.x, point.y)
      else await page.touchscreen.tap(point.x, point.y)
      await expect(page).toHaveURL(/#\/$/)
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
      await expect(page.getByRole('heading', { name: 'Студент ИУ5', level: 1 })).toBeVisible()
      await expect(page.locator('.course-grid a')).toHaveCount(3)
      await expect(page.getByRole('region', { name: 'Полезные ссылки' })).toBeVisible()
    }
  })

  test('stacks decorative icons over labels and keeps the selection bubble inside each tab at 320px', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/#/')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const labels = ['Каталог', 'Поиск', 'Расписание', 'Профиль']
    for (const label of labels) {
      const link = nav.getByRole('link', { name: label })
      await link.click()
      await expect(link).toHaveAttribute('aria-current', 'page')
      const geometry = await nav.evaluate((element, activeLabel) => {
        const navBox = element.getBoundingClientRect()
        const links = [...element.querySelectorAll('a')]
        const active = links.find((item) => item.textContent === activeLabel)!
        const activeBox = active.getBoundingClientRect()
        const indicator = getComputedStyle(element, '::before')
        const indicatorLeft = navBox.left + Number.parseFloat(indicator.left) + new DOMMatrixReadOnly(indicator.transform).m41
        return {
          navRight: navBox.right,
          viewport: innerWidth,
          activeLeft: activeBox.left,
          activeRight: activeBox.right,
          indicatorLeft,
          indicatorRight: indicatorLeft + Number.parseFloat(indicator.width),
          tabs: links.map((item) => {
            const box = item.getBoundingClientRect()
            const icon = item.querySelector('svg')!
            const iconBox = icon.getBoundingClientRect()
            const labelBox = item.querySelector('span')!.getBoundingClientRect()
            return { width: box.width, height: box.height, iconHidden: icon.getAttribute('aria-hidden'), iconFocusable: icon.getAttribute('focusable'), iconBottom: iconBox.bottom, labelTop: labelBox.top, iconCenter: iconBox.left + iconBox.width / 2, labelCenter: labelBox.left + labelBox.width / 2 }
          }),
        }
      }, label)
      expect(geometry.navRight).toBeLessThanOrEqual(geometry.viewport)
      expect(geometry.tabs.every((tab) => tab.width >= 44 && tab.height >= 44)).toBe(true)
      expect(geometry.tabs.every((tab) => tab.iconHidden === 'true' && tab.iconFocusable === 'false')).toBe(true)
      expect(geometry.tabs.every((tab) => tab.iconBottom <= tab.labelTop && Math.abs(tab.iconCenter - tab.labelCenter) <= 1)).toBe(true)
      expect(geometry.indicatorLeft).toBeGreaterThanOrEqual(geometry.activeLeft - 2)
      expect(geometry.indicatorRight).toBeLessThanOrEqual(geometry.activeRight + 2)
    }
  })

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
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    for (const [label, file] of [['Каталог', 'catalog'], ['Поиск', 'search'], ['Расписание', 'schedule'], ['Профиль', 'profile']] as const) {
      const tab = nav.getByRole('link', { name: label })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-current', 'page')
      await page.locator('.bottom-touch-bar').screenshot({ path: testInfo.outputPath(`bottom-bar-${file}.png`) })
    }
    await page.evaluate(() => {
      const webApp = (window as Window & { Telegram: { WebApp: { colorScheme: string; themeParams: Record<string, string> } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      webApp.colorScheme = 'dark'
      Object.assign(webApp.themeParams, { bg_color: '#0d203a', text_color: '#f5f7fb', secondary_bg_color: '#14345b', button_color: '#1688ff', button_text_color: '#fff' })
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('themeChanged')
    })
    await page.locator('.bottom-touch-bar').screenshot({ path: testInfo.outputPath('bottom-bar-profile-dark.png') })
    await page.setViewportSize({ width: 320, height: 844 })
    await nav.getByRole('link', { name: 'Расписание' }).click()
    await page.locator('.bottom-touch-bar').screenshot({ path: testInfo.outputPath('bottom-bar-schedule-320-dark.png') })
    await page.evaluate(() => { window.scrollTo(0, 0) })
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
