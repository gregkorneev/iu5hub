import { test, expect } from './fixtures'

test.describe('persistent bottom navigation', () => {
  test('places the Telegram mobile brand below interface controls and centers it in the header', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 844 })
    await page.goto('/#/')
    await page.evaluate(() => {
      const app = (window as Window & { Telegram: { WebApp: { safeAreaInset: Record<string, number>; contentSafeAreaInset: Record<string, number> } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.safeAreaInset = { top: 59, right: 0, bottom: 34, left: 0 }
      app.contentSafeAreaInset = { top: 92, right: 0, bottom: 34, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('contentSafeAreaChanged')
    })

    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.app > header')!.getBoundingClientRect()
      const brand = document.querySelector('.header-brand-group')!.getBoundingClientRect()
      return { headerLeft: header.left, headerWidth: header.width, headerTop: header.top, brandLeft: brand.left, brandWidth: brand.width }
    })
    expect(geometry.headerTop).toBeGreaterThanOrEqual(99)
    const greeting = await page.locator('.user-greeting').boundingBox()
    const header = await page.locator('.app > header').boundingBox()
    expect(greeting && header).toBeTruthy()
    expect(greeting!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
    expect(Math.abs(geometry.brandLeft + geometry.brandWidth / 2 - (geometry.headerLeft + geometry.headerWidth / 2))).toBeLessThanOrEqual(1)
  })

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
      if (testInfo.project.use.isMobile) await page.touchscreen.tap(point.x, point.y)
      else await page.mouse.click(point.x, point.y)
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

  test('keeps Quiet Glass readable and keyboard-accessible from 295px through 430px', async ({ page, browserName }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const labels = ['Каталог', 'Поиск', 'Расписание', 'Профиль']

    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((colorScheme) => {
        const telegram = (window as Window & { Telegram: { WebApp: { colorScheme: string; themeParams: Record<string, string> } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
        telegram.colorScheme = colorScheme
        Object.assign(telegram.themeParams, colorScheme === 'dark'
          ? { bg_color: '#0d203a', text_color: '#f5f7fb', secondary_bg_color: '#14345b', button_color: '#1688ff', button_text_color: '#fff' }
          : { bg_color: '#f6faff', text_color: '#1a1a19', secondary_bg_color: '#e7eef6', button_color: '#1769aa', button_text_color: '#fff' })
        ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('themeChanged')
      }, theme)

      for (const width of [295, 320, 390, 430]) {
        await page.setViewportSize({ width, height: 720 })
        for (const label of labels) {
          const link = nav.getByRole('link', { name: label })
          await link.click()
          await expect(link).toHaveAttribute('aria-current', 'page')
          const geometry = await nav.evaluate((element) => {
            const navBox = element.getBoundingClientRect()
            const links = [...element.querySelectorAll('a')].map((item) => item.getBoundingClientRect())
            const activeBox = element.querySelector('a[aria-current="page"]')!.getBoundingClientRect()
            const lens = getComputedStyle(element, '::before')
            const lensLeft = navBox.left + Number.parseFloat(lens.left) + new DOMMatrixReadOnly(lens.transform).m41
            return {
              count: links.length,
              overflow: document.documentElement.scrollWidth > innerWidth,
              links: links.map((box) => ({ width: box.width, height: box.height })),
              lensLeft,
              lensRight: lensLeft + Number.parseFloat(lens.width),
              activeLeft: activeBox.left,
              activeRight: activeBox.right,
              filter: getComputedStyle(element).backdropFilter,
              prefixedFilter: getComputedStyle(element).webkitBackdropFilter,
              lensFilter: getComputedStyle(element, '::before').backdropFilter,
              after: getComputedStyle(element, '::after').content,
            }
          })
          expect(geometry.count).toBe(4)
          expect(geometry.overflow).toBe(false)
          expect(geometry.links.every((box) => box.width >= 44 && box.height >= 44)).toBe(true)
          expect(Math.abs(geometry.lensLeft - geometry.activeLeft)).toBeLessThanOrEqual(2)
          expect(Math.abs(geometry.lensRight - geometry.activeRight)).toBeLessThanOrEqual(2)
          expect(geometry.lensFilter).toBe('none')
          expect(geometry.after).toBe('none')
          expect(geometry.filter !== 'none' || geometry.prefixedFilter !== 'none').toBe(true)
        }

        if (width === 295 && browserName === 'chromium') await page.locator('.bottom-touch-bar').screenshot({ path: testInfo.outputPath(`quiet-glass-${theme}-${width}.png`) })
      }
    }

    await page.emulateMedia({ contrast: 'more' })
    const supportsContrastPreference = await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches)
    if (supportsContrastPreference) expect(await nav.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe('none')
    await page.emulateMedia({ contrast: 'no-preference' })
    if (browserName === 'chromium') {
      const session = await page.context().newCDPSession(page)
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
      const filters = await nav.evaluate((element) => {
        const style = getComputedStyle(element)
        return { standard: style.backdropFilter, prefixed: style.webkitBackdropFilter }
      })
      expect(filters.standard).toBe('none')
      expect(filters.prefixed ?? 'none').toBe('none')
      await session.detach()
    }

    if (browserName !== 'webkit') {
      await page.getByRole('link', { name: 'Поиск' }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      const focused = await nav.getByRole('link', { name: 'Поиск' }).evaluate((element) => ({
        active: document.activeElement === element,
        keyboardFocus: element.matches(':focus-visible'),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth,
      }))
      expect(focused.active).toBe(true)
      expect(focused.keyboardFocus).toBe(true)
      expect(focused.outlineStyle).toBe('solid')
      expect(focused.outlineWidth).toBe('2px')
    }

    await page.setViewportSize({ width: 390, height: 568 })
    await page.goto('/#/course/course-1')
    const navTop = await nav.evaluate((element) => element.getBoundingClientRect().top)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
    await expect.poll(() => nav.evaluate((element) => element.getBoundingClientRect().top)).toBe(navTop)
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
    const searchInput = page.getByRole('searchbox', { name: 'Поиск по предметам и преподавателям' })
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
    await expect(page.getByLabel('Подсказки поиска')).toHaveCount(0)
    await searchInput.evaluate((input: HTMLInputElement) => input.blur())
    await nav.getByRole('link', { name: 'Поиск' }).click()
    await expect(searchInput).toBeFocused()
    await expect(page.getByLabel('Подсказки поиска')).toHaveCount(0)
  })

  test('settles the decorative lens on the final tab after rapid and repeated selection', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const tabs = ['Поиск', 'Расписание', 'Профиль', 'Каталог', 'Профиль']

    for (const label of tabs) await nav.getByRole('link', { name: label }).click()
    await nav.getByRole('link', { name: 'Профиль' }).click()
    await expect(nav.getByRole('link', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page')
    await expect.poll(() => nav.evaluate((element) => {
      const lens = getComputedStyle(element, '::before')
      const navBox = element.getBoundingClientRect()
      const active = element.querySelector<HTMLElement>('a[aria-current="page"]')!.getBoundingClientRect()
      const lensLeft = navBox.left + Number.parseFloat(lens.left) + new DOMMatrixReadOnly(lens.transform).m41
      const lensRight = lensLeft + Number.parseFloat(lens.width)
      return Math.abs(lensLeft - active.left) <= 2 && Math.abs(lensRight - active.right) <= 2
    })).toBe(true)
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
    const brand = await page.locator('header .brand').boundingBox()
    const statisticsBounds = await statistics.boundingBox()
    const group = await page.locator('header .header-brand-group').boundingBox()
    const header = await page.locator('header').boundingBox()
    expect(header && brand && statisticsBounds && group).toBeTruthy()
    expect(Math.abs(brand!.x + brand!.width / 2 - (header!.x + header!.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(group!.x + group!.width / 2 - (header!.x + header!.width / 2))).toBeLessThanOrEqual(1)
    expect(statisticsBounds!.x).toBeGreaterThan(header!.x + header!.width / 2)
    expect(header!.x + header!.width - (statisticsBounds!.x + statisticsBounds!.width)).toBeGreaterThanOrEqual(2)
    expect(header!.x + header!.width - (statisticsBounds!.x + statisticsBounds!.width)).toBeLessThanOrEqual(20)
    expect(group!.x).toBeGreaterThanOrEqual(header!.x)
    expect(group!.x + group!.width).toBeLessThanOrEqual(header!.x + header!.width)
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
    await page.getByRole('searchbox', { name: 'Поиск по предметам и преподавателям' }).focus()
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
    await page.getByRole('searchbox', { name: 'Поиск по предметам и преподавателям' }).fill('ГРИБ')
    await page.getByRole('searchbox', { name: 'Поиск по предметам и преподавателям' }).press('Enter')
    await page.screenshot({ path: testInfo.outputPath('search-results.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 500 })
    await page.getByRole('searchbox', { name: 'Поиск по предметам и преподавателям' }).focus()
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
