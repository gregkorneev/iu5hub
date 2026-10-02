import { test, expect } from './fixtures'

test('shows the Telegram identity as a compact link to Profile only for signed-in users', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/#/')
    const identity = page.getByRole('link', { name: /Открыть профиль:/ })
    await expect(identity).toHaveAttribute('href', '#/profile')
    await expect(identity.locator('.user-greeting__avatar')).toHaveText('С')
    await expect(identity.locator('strong')).toContainText('Студент с очень длинным именем')
    await expect(identity.locator('small')).toHaveText('@student')
    const bounds = await identity.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await identity.click()
    await expect(page).toHaveURL(/#\/profile$/)
    await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible()
  }
  await page.evaluate(() => { (window as Window & { Telegram: { WebApp: { initDataUnsafe: { user?: unknown } } } }).Telegram.WebApp.initDataUnsafe.user = undefined })
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Каталог' }).click()
  await expect(page.locator('.user-greeting')).toHaveCount(0)
})

test('shows clickable Yandex Disk and GitHub links below courses on the home screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/')

  const brandGeometry = await page.evaluate(() => {
    const group = document.querySelector('.header-brand-group')!.getBoundingClientRect()
    const greeting = document.querySelector('.user-greeting')!.getBoundingClientRect()
    return {
      groupCenter: group.left + group.width / 2,
      headerCenter: document.querySelector('.app > header')!.getBoundingClientRect().left + document.querySelector('.app > header')!.getBoundingClientRect().width / 2,
      greetingLeft: greeting.left,
      descriptionLeft: document.querySelector('.hero > p:not(.eyebrow)')!.getBoundingClientRect().left,
      coursesLeft: document.querySelector('.home-courses h2')!.getBoundingClientRect().left,
      greetingColor: getComputedStyle(document.querySelector('.user-greeting')!).color,
      brandColor: getComputedStyle(document.querySelector('.brand')!).color,
      greetingFontSize: parseFloat(getComputedStyle(document.querySelector('.user-greeting')!).fontSize),
    }
  })
  expect(Math.abs(brandGeometry.groupCenter - brandGeometry.headerCenter)).toBeLessThanOrEqual(1)
  expect(brandGeometry.greetingLeft).toBeCloseTo(brandGeometry.descriptionLeft, 0)
  expect(brandGeometry.greetingLeft).toBeCloseTo(brandGeometry.coursesLeft, 0)
  expect(brandGeometry.greetingColor).toBe(brandGeometry.brandColor)
  expect(brandGeometry.greetingFontSize).toBeGreaterThanOrEqual(16)
  await expect(page.locator('.hero h1')).toHaveClass(/sr-only/)

  const courses = page.locator('.home-courses')
  const usefulLinks = page.getByRole('region', { name: 'Полезные ссылки' })
  await expect(courses).toBeVisible()
  await expect(usefulLinks).toBeVisible()
  await expect(page.locator('.home-favorites')).toHaveCount(0)
  const yandexLink = usefulLinks.getByRole('link', { name: 'Диск ИУ5 от @kirschnya' })
  const freshmenLink = usefulLinks.getByRole('link', { name: 'Будущим первокурсникам' })
  const githubLink = usefulLinks.getByRole('link', { name: 'GitHub @tal3nt3d' })
  const ugapanyukLink = usefulLinks.getByRole('link', { name: 'GitHub Ю. Е. Гапанюк' })
  await expect(yandexLink).toHaveAttribute('href', 'https://disk.yandex.com/d/4PO5hHMPMaeAEQ/IU5')
  await expect(freshmenLink).toHaveAttribute('href', 'https://disk.yandex.com/d/4PO5hHMPMaeAEQ/IU5/0%20sem')
  await expect(githubLink).toHaveAttribute('href', 'https://github.com/tal3nt3d/iu5manual')
  await expect(ugapanyukLink).toHaveAttribute('href', 'https://ugapanyuk.github.io')
  await expect(yandexLink).toHaveAttribute('target', '_blank')
  await expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  for (const [link, lines] of [[yandexLink, ['Диск ИУ5 от', '@kirschnya']], [freshmenLink, ['Будущим', 'первокурсникам']], [githubLink, ['GitHub', '@tal3nt3d']], [ugapanyukLink, ['GitHub', 'Ю. Е. Гапанюк']]] as const) {
    await expect(link.locator('.home-links__label > span')).toHaveText(lines)
    await expect(link).toHaveAttribute('aria-label', lines.join(' '))
  }
  for (const link of [yandexLink, freshmenLink, githubLink, ugapanyukLink]) {
    await expect(link.locator('svg')).toHaveCount(1)
    const box = await link.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  const linkRows = await usefulLinks.locator('.home-links__list > li').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)))
  expect(new Set(linkRows.slice(0, 3)).size).toBe(1)
  expect(linkRows[3]).toBeGreaterThan(linkRows[0])

  const coursesBounds = await courses.boundingBox()
  const linksBounds = await usefulLinks.boundingBox()
  expect(coursesBounds && linksBounds).toBeTruthy()
  expect(linksBounds!.y).toBeGreaterThan(coursesBounds!.y + coursesBounds!.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: testInfo.outputPath('home-useful-links.png') })
  await page.evaluate(() => {
    const webApp = (window as Window & { Telegram: { WebApp: { colorScheme: string; themeParams: Record<string, string> } }; __telegramEmit: (event: string) => void })
    webApp.Telegram.WebApp.colorScheme = 'dark'
    webApp.Telegram.WebApp.themeParams = { bg_color: '#071d3c', text_color: '#f6faff', secondary_bg_color: '#102d52', button_color: '#1688ff', button_text_color: '#ffffff' }
    webApp.__telegramEmit('themeChanged')
  })
  await expect(page.locator('html')).toHaveAttribute('data-telegram-theme', 'dark')
  await page.screenshot({ path: testInfo.outputPath('home-useful-links-dark.png') })

  await yandexLink.click()
  await freshmenLink.click()
  await githubLink.click()
  await ugapanyukLink.click()
  expect(await page.evaluate(() => (window as Window & { __telegram: { opened: string[] } }).__telegram.opened)).toEqual(['https://disk.yandex.com/d/4PO5hHMPMaeAEQ/IU5', 'https://disk.yandex.com/d/4PO5hHMPMaeAEQ/IU5/0%20sem', 'https://github.com/tal3nt3d/iu5manual', 'https://ugapanyuk.github.io/'])
})

test('shows a Favorites block between courses and Useful Links and opens the existing profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/profile/favorites', (route) => route.fulfill({ json: { items: [
    { courseId: 'course-1', path: '/1 sem/Математика', type: 'dir', name: 'Математика', createdAt: 2 },
    { courseId: 'course-1', path: '/1 sem/Физика.pdf', type: 'file', name: 'Физика.pdf', createdAt: 1 },
  ] } }))
  await page.goto('/#/')

  const courses = page.locator('.home-courses')
  const favorites = page.getByRole('region', { name: 'Избранное' })
  const usefulLinks = page.getByRole('region', { name: 'Полезные ссылки' })
  await expect(favorites).toBeVisible()
  await expect(favorites.locator('.home-favorites__count')).toHaveText('2')
  await expect(favorites).toContainText('Сохранённые папки и файлы')
  const [coursesBounds, favoritesBounds, linksBounds] = await Promise.all([courses.boundingBox(), favorites.boundingBox(), usefulLinks.boundingBox()])
  expect(coursesBounds && favoritesBounds && linksBounds).toBeTruthy()
  expect(favoritesBounds!.y).toBeGreaterThan(coursesBounds!.y + coursesBounds!.height)
  expect(linksBounds!.y).toBeGreaterThan(favoritesBounds!.y + favoritesBounds!.height)

  await favorites.getByRole('link', { name: /Избранное/ }).click()
  await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible()
  await expect(page.getByText('Математика', { exact: true })).toBeVisible()
  await expect(page.getByText('Физика.pdf', { exact: true })).toBeVisible()
})

test('centers the full home stack including Favorites on a tall phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/profile/favorites', (route) => route.fulfill({ json: { items: [
    { courseId: 'course-1', path: '/1 sem/Математика', type: 'dir', name: 'Математика', createdAt: 1 },
  ] } }))
  await page.goto('/#/')
  await expect(page.locator('.home-favorites')).toBeVisible()

  const geometry = await page.evaluate(() => {
    const main = document.querySelector('main')!
    const mainBox = main.getBoundingClientRect()
    const stackBox = document.querySelector('.home-content-stack')!.getBoundingClientRect()
    const styles = getComputedStyle(main)
    const innerTop = mainBox.top + parseFloat(styles.paddingTop)
    const innerBottom = mainBox.bottom - parseFloat(styles.paddingBottom)
    return {
      stackCenter: stackBox.top + stackBox.height / 2,
      availableCenter: (innerTop + innerBottom) / 2,
      mainScrollHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      width: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }
  })
  expect(Math.abs(geometry.stackCenter - geometry.availableCenter)).toBeLessThanOrEqual(8)
  expect(geometry.mainScrollHeight).toBeLessThanOrEqual(geometry.mainClientHeight + 1)
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth)
  await page.screenshot({ path: testInfo.outputPath('home-balanced-390x844-with-favorites.png') })
})

test('fits Home with a saved item and Telegram fullscreen insets without hiding real overflow', async ({ page }, testInfo) => {
  await page.route('**/api/profile/favorites', route => route.fulfill({ json: { items: [
    { courseId: 'course-1', path: '1 семестр', type: 'dir', name: '1 семестр', createdAt: 1 },
  ] } }))
  for (const [height, top] of [[844, 24], [844, 92], [853, 92], [720, 92]]) {
    await page.setViewportSize({ width: 393, height })
    await page.goto('/#/')
    await page.evaluate(({ height, top }) => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; safeAreaInset: object; contentSafeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = height
      app.viewportStableHeight = height
      app.safeAreaInset = { top: top === 92 ? 59 : 0, right: 0, bottom: 34, left: 0 }
      app.contentSafeAreaInset = { top, right: 0, bottom: 34, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
    }, { height, top })
    await expect(page.locator('.home-favorites')).toBeVisible()
    const geometry = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      return { doc: document.documentElement.scrollHeight, body: document.body.scrollHeight, main: main.scrollHeight, client: main.clientHeight,
        greeting: box('.user-greeting').top, header: box('header').bottom, links: box('.home-links').bottom, footer: box('footer').top, footerBottom: box('footer').bottom, nav: box('.bottom-nav').top }
    })
    expect(geometry.doc).toBeLessThanOrEqual(height + 1)
    expect(geometry.body).toBeLessThanOrEqual(height + 1)
    expect(geometry.greeting).toBeGreaterThanOrEqual(geometry.header)
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.nav - 4)
    if (height >= 844) {
      expect(geometry.main, `${height}px viewport, ${top}px top inset`).toBeLessThanOrEqual(geometry.client + 1)
      expect(geometry.links).toBeLessThanOrEqual(geometry.footer + 1)
      await page.locator('main').evaluate(element => element.scrollTo(0, 100))
      expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeLessThanOrEqual(1)
    } else {
      expect(geometry.main).toBeGreaterThan(geometry.client)
      await page.locator('main').evaluate(element => element.scrollTo(0, element.scrollHeight))
      expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await expect(page.getByRole('link', { name: 'Будущим первокурсникам' })).toBeInViewport()
    }
    if (height === 844 && top === 92) await page.screenshot({ path: testInfo.outputPath('home-393x844-telegram-fullscreen-favorite.png') })
  }
})

test('uses the visible CSS viewport when Telegram reports stale Home heights', async ({ page }, testInfo) => {
  await page.route('**/api/profile/favorites', route => route.fulfill({ json: { items: [
    { courseId: 'course-1', path: '1 семестр', type: 'dir', name: '1 семестр', createdAt: 1 },
  ] } }))
  for (const [height, reported] of [[852, 1100], [852, 700], [568, 1100]]) {
    await page.setViewportSize({ width: 393, height })
    await page.goto('/#/')
    await page.evaluate(reportedHeight => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; safeAreaInset: object; contentSafeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = reportedHeight
      app.viewportStableHeight = reportedHeight
      app.safeAreaInset = { top: 59, right: 0, bottom: 34, left: 0 }
      app.contentSafeAreaInset = { top: 92, right: 0, bottom: 34, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
    }, reported)
    await expect(page.locator('.home-favorites')).toBeVisible()
    const metrics = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      return { viewport: innerHeight, appHeight: box('.app').height, html: document.documentElement.scrollHeight, body: document.body.scrollHeight,
        mainScroll: main.scrollHeight, mainClient: main.clientHeight, headerBottom: box('header').bottom, greetingTop: box('.user-greeting').top,
        linksBottom: box('.home-links').bottom, footerTop: box('footer').top, footerBottom: box('footer').bottom, navTop: box('.bottom-nav').top }
    })
    expect(metrics.appHeight).toBeCloseTo(metrics.viewport, 0)
    expect(metrics.html).toBeLessThanOrEqual(height + 1)
    expect(metrics.body).toBeLessThanOrEqual(height + 1)
    expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.navTop - 4)
    if (height === 852) {
      expect(metrics.mainScroll, `${height}px CSS viewport with Telegram reporting ${reported}px`).toBeLessThanOrEqual(metrics.mainClient + 1)
      expect(metrics.greetingTop).toBeGreaterThanOrEqual(metrics.headerBottom)
      expect(metrics.linksBottom).toBeLessThanOrEqual(metrics.footerTop)
      await page.locator('main').evaluate(element => element.scrollTo(0, 100))
      expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeLessThanOrEqual(1)
      await page.screenshot({ path: testInfo.outputPath(`home-393x852-telegram-reports-${reported}.png`) })
    } else {
      expect(metrics.mainScroll).toBeGreaterThan(metrics.mainClient)
      await page.locator('main').evaluate(element => element.scrollTo(0, element.scrollHeight))
      expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await expect(page.getByRole('link', { name: 'Будущим первокурсникам' })).toBeInViewport()
    }
  }
})

test('fits the complete home screen without page or main scrolling on Telegram phones', async ({ page }, testInfo) => {
  for (const [width, height] of [[295, 667], [320, 568], [375, 667], [390, 720], [390, 730], [390, 844], [393, 852], [430, 932]]) {
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
        header: box('header'), greeting: box('.user-greeting'), content: box('main'), stack: box('.home-content-stack'), hero: box('.hero'), heroTitle: box('.hero h1'), heroDescription: box('.hero > p:not(.eyebrow)'), courses: box('.home-courses'), coursesTitle: box('.home-courses h2'), courseGrid: box('.course-grid'), favorites: document.querySelector('.home-favorites')?.getBoundingClientRect().toJSON() ?? null, links: box('.home-links'), footer: box('footer'), nav: box('.bottom-nav'),
        centerBias: (box('main').top + box('main').height / 2) - (box('.home-content-stack').top + box('.home-content-stack').height / 2),
        innerTop: box('main').top + parseFloat(getComputedStyle(document.querySelector('main')!).paddingTop),
        innerBottom: box('main').bottom - parseFloat(getComputedStyle(document.querySelector('main')!).paddingBottom),
        cards: [...document.querySelectorAll('.course-grid a')].map((card) => ({ box: card.getBoundingClientRect().toJSON(), scroll: card.scrollHeight, client: card.clientHeight })),
      }
    })
    expect(metrics.html, `${width}×${height} document`).toBeLessThanOrEqual(height + 1)
    expect(metrics.body, `${width}×${height} body`).toBeLessThanOrEqual(height + 1)
    expect(metrics.width, `${width}×${height} horizontal`).toBeLessThanOrEqual(width)
    expect(metrics.main, `${width}×${height} main`).toBeLessThanOrEqual(metrics.mainClient + 1)
    if ([390, 393, 430].includes(width) && height >= 844) {
      const stackCenter = metrics.stack.top + metrics.stack.height / 2
      const availableCenter = (metrics.innerTop + metrics.innerBottom) / 2
      expect(Math.abs(stackCenter - availableCenter), `${width}×${height} content stack should be centered in free space`).toBeLessThanOrEqual(8)
      expect(metrics.centerBias, `${width}×${height} stack should sit slightly above main center`).toBeGreaterThanOrEqual(20)
      expect(metrics.greeting.top - metrics.header.bottom, `${width}×${height} should keep a gap after the header`).toBeGreaterThanOrEqual(24)
    }
    expect(metrics.greeting.top).toBeGreaterThanOrEqual(metrics.header.bottom)
    expect(Math.abs(metrics.greeting.left - metrics.heroDescription.left), `${width}×${height} greeting left alignment`).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.greeting.left - metrics.coursesTitle.left), `${width}×${height} courses left alignment`).toBeLessThanOrEqual(1)
    expect(metrics.hero.top).toBeGreaterThanOrEqual(metrics.greeting.bottom)
    expect(metrics.heroTitle.width).toBeLessThanOrEqual(1)
    expect(metrics.heroDescription.top - metrics.greeting.bottom, `${width}×${height} greeting → description`).toBeGreaterThanOrEqual(4)
    expect(metrics.coursesTitle.top - metrics.heroDescription.bottom, `${width}×${height} description → course label`).toBeGreaterThanOrEqual(height > 740 ? 15.95 : 3.95)
    expect(metrics.courseGrid.top - metrics.coursesTitle.bottom, `${width}×${height} course label → cards`).toBeGreaterThanOrEqual(width <= 340 && height <= 600 ? 4 : 8)
    expect(metrics.header.top).toBeGreaterThanOrEqual(24)
    expect(metrics.links.bottom).toBeLessThanOrEqual(metrics.content.bottom + 1)
    const homeSectionGap = height > 740 ? 16 : 0
    if (metrics.favorites) {
      expect(metrics.links.top).toBeGreaterThanOrEqual(metrics.favorites.bottom)
      expect(metrics.favorites.top - metrics.courses.bottom, `${width}×${height} courses → favorites`).toBeGreaterThanOrEqual(homeSectionGap)
      expect(metrics.links.top - metrics.favorites.bottom, `${width}×${height} favorites → useful links`).toBeGreaterThanOrEqual(homeSectionGap)
    } else {
      expect(metrics.links.top - metrics.courses.bottom, `${width}×${height} courses → useful links`).toBeGreaterThanOrEqual(homeSectionGap - 0.05)
    }
    expect(metrics.footer.top).toBeGreaterThanOrEqual(metrics.links.bottom)
    expect(metrics.footer.bottom).toBeLessThanOrEqual(metrics.nav.top - 4)
    expect(metrics.nav.bottom).toBeLessThanOrEqual(height - 24)
    await expect(page.getByText('Учебные материалы', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Материалы на Яндекс.Диске' })).toHaveCount(0)
    expect(metrics.cards.every((card) => card.box.top >= metrics.content.top && card.box.bottom <= metrics.content.bottom + 1 && card.scroll <= card.client + 1)).toBe(true)
    await page.locator('main').evaluate((element) => element.scrollTo(0, 100))
    await page.evaluate(() => window.scrollTo(0, 100))
    const scrollOffsets = await page.evaluate(() => ({ page: scrollY, main: document.querySelector('main')!.scrollTop, body: document.body.scrollTop }))
    expect(scrollOffsets.page).toBe(0)
    expect(scrollOffsets.body).toBe(0)
    expect(scrollOffsets.main, `${width}×${height} should not have meaningful main scrolling`).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`home-${width}x${height}.png`) })
  }
})

test('keeps home sections separated in the compact Telegram tablet window', async ({ page }, testInfo) => {
  await page.route('**/api/profile/favorites', (route) => route.fulfill({ json: { items: [
    { courseId: 'course-1', path: '/1 sem/Математика', type: 'dir', name: 'Математика', createdAt: 1 },
  ] } }))

  for (const [width, height] of [[480, 700], [480, 730], [520, 700], [520, 730], [600, 700], [600, 730], [620, 730]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/#/')
    await expect(page.locator('.home-favorites')).toBeVisible()
    await expect(page.locator('.bottom-nav')).toBeVisible()
    await page.evaluate((viewportHeight) => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; contentSafeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = viewportHeight
      app.viewportStableHeight = viewportHeight
      app.contentSafeAreaInset = { top: 0, right: 0, bottom: 0, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
    }, height)

    const geometry = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      const courses = box('.home-courses')
      const favorites = box('.home-favorites')
      const links = box('.home-links')
      const main = document.querySelector('main')!
      const footer = box('footer')
      const nav = box('.bottom-nav')
      return {
        coursesToFavorites: favorites.top - courses.bottom,
        favoritesToLinks: links.top - favorites.bottom,
        mainScrollHeight: main.scrollHeight,
        mainClientHeight: main.clientHeight,
        footerToNav: nav.top - footer.bottom,
        documentWidth: document.documentElement.scrollWidth,
      }
    })

    expect(geometry.coursesToFavorites, `${width}×${height}: courses to Favorites`).toBeGreaterThanOrEqual(7.95)
    expect(geometry.favoritesToLinks, `${width}×${height}: Favorites to Useful Links`).toBeGreaterThanOrEqual(7.95)
    expect(geometry.mainScrollHeight, `${width}×${height}: main should fit`).toBeLessThanOrEqual(geometry.mainClientHeight + 1)
    expect(geometry.footerToNav, `${width}×${height}: footer should clear bottom bar`).toBeGreaterThanOrEqual(4)
    expect(geometry.documentWidth, `${width}×${height}: no horizontal overflow`).toBeLessThanOrEqual(width)
    if (width === 520 && height === 730) await page.screenshot({ path: testInfo.outputPath('home-ipad-telegram-520x730.png') })
  }
})
