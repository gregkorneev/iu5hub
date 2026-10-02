import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

test('selects a group, shows a centered seven-day picker, and keeps four-tab navigation at 320px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/#/schedule')
  const nav = page.getByRole('navigation', { name: 'Основная навигация' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  await expect(nav.getByRole('link', { name: 'Расписание' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.bottom-touch-bar').getByRole('button', { name: '← Назад' })).toHaveCount(0)
  const geometry = await nav.evaluate((element) => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth, links: [...element.querySelectorAll('a')].map((link) => ({ width: link.clientWidth, height: link.clientHeight, text: link.scrollWidth <= link.clientWidth })) }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width)
  expect(geometry.links.every((item) => item.width >= 44 && item.height >= 44 && item.text), JSON.stringify(geometry.links)).toBeTruthy()

  const search = page.getByRole('combobox', { name: 'Найдите свою группу' })
  await expect(search).toBeVisible()
  await search.fill('34б')
  await page.getByRole('button', { name: 'ИУ5-34Б' }).click()
  await expect(page.getByRole('heading', { name: 'Электротехника' })).toBeVisible()
  await expect(page.locator('.schedule-week')).toHaveText(/^\d+-я неделя · (числитель|знаменатель)$/)
  await expect(page.getByText('Сейчас')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сегодня', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Неделя', exact: true })).toHaveCount(0)
  const days = page.getByRole('group', { name: 'Выбор даты' })
  await expect(days).toBeVisible()
  await expect(days.getByRole('button')).toHaveCount(7)
  const dayScroll = await days.evaluate((element) => ({ overflowX: getComputedStyle(element).overflowX, overflowY: getComputedStyle(element).overflowY, scrollbarWidth: getComputedStyle(element).scrollbarWidth, width: element.clientWidth, contentWidth: element.scrollWidth }))
  expect(dayScroll.overflowX).toBe('auto')
  expect(dayScroll.overflowY).toBe('hidden')
  expect(dayScroll.scrollbarWidth).toBe('none')
  expect(dayScroll.contentWidth).toBeGreaterThan(dayScroll.width)
  await expect(days.getByRole('button').nth(3)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.schedule-week')).toBeVisible()
  expect(await page.locator('.schedule-week').evaluate((element) => element.clientHeight <= Number.parseFloat(getComputedStyle(element).lineHeight) + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await days.evaluate((element) => {
    const selected = element.querySelector('button[aria-pressed="true"]')!.getBoundingClientRect()
    const viewport = element.getBoundingClientRect()
    return Math.abs(selected.left + selected.width / 2 - (viewport.left + viewport.width / 2))
  })).toBeLessThanOrEqual(1)
  const expectedWindow = await page.evaluate(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const base = new Date(`${today}T12:00:00Z`)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base)
      date.setUTCDate(date.getUTCDate() + index - 3)
      return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(date)
    })
  })
  expect(await days.locator('button strong').allTextContents()).toEqual(expectedWindow)
  await page.screenshot({ path: testInfo.outputPath('week-window-320.png') })
  await days.getByRole('button').nth(2).click()
  await expect(days.getByRole('button').nth(2)).toHaveAttribute('aria-pressed', 'true')
  expect(await days.locator('button strong').allTextContents()).toEqual(expectedWindow)
  await days.getByRole('button').nth(3).click()
  await expect(days.getByRole('button').nth(3)).toHaveAttribute('aria-pressed', 'true')
  expect(await days.evaluate((element) => {
    const selected = element.querySelector('button[aria-pressed="true"]')!.getBoundingClientRect()
    const viewport = element.getBoundingClientRect()
    return Math.abs(selected.left + selected.width / 2 - (viewport.left + viewport.width / 2))
  })).toBeLessThanOrEqual(1)
  await expect(page.locator('.schedule-meta')).toContainText('2026/2027 · осень')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Электротехника' })).toBeVisible()
  const accessibility = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('shows and changes the selected group in Profile without delaying Favorites', async ({ page }) => {
  await page.goto('/#/profile')
  await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible()
  await expect(page.locator('.schedule-profile-block')).toContainText('Не выбрана')
  await page.locator('.schedule-profile-block').getByRole('button', { name: 'Выбрать' }).click()
  await page.getByRole('button', { name: 'ИУ5-34Б' }).click()
  await expect(page.locator('.schedule-profile-block')).toContainText('ИУ5-34Б')
  await expect(page.getByRole('heading', { name: 'В избранном пока ничего нет' })).toBeVisible()
})

test('gives profile text blocks breathing room across mobile and desktop widths', async ({ page }, testInfo) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/profile')
    const username = page.locator('.profile-username')
    await expect(username).toBeVisible()
    const gaps = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      return {
        eyebrowTitle: box('.profile-page > h1').top - box('.profile-page > .eyebrow').bottom,
        titleUsername: box('.profile-username').top - box('.profile-page > h1').bottom,
        usernameGroup: box('.profile-page > .schedule-profile-block').top - box('.profile-username').bottom,
        groupMaterials: box('.profile-section-title').top - box('.profile-page > .schedule-profile-block').bottom,
      }
    })
    expect(gaps.eyebrowTitle).toBeGreaterThanOrEqual(12)
    expect(gaps.titleUsername).toBeGreaterThanOrEqual(12)
    expect(gaps.usernameGroup).toBeGreaterThanOrEqual(24)
    expect(gaps.groupMaterials).toBeGreaterThanOrEqual(31.95)
    await page.screenshot({ path: testInfo.outputPath(`profile-spacing-${width}.png`) })
  }
})

test('uses the available width for Profile on iPad landscape', async ({ page }, testInfo) => {
  for (const { width, height } of [{ width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize({ width, height })
    await page.goto('/#/profile')
    const sizes = await page.evaluate(() => {
      const main = document.querySelector('main')!.getBoundingClientRect()
      const profile = document.querySelector('.profile-page')!.getBoundingClientRect()
      return { main: main.width, profile: profile.width, overflow: document.documentElement.scrollWidth - innerWidth }
    })
    expect(sizes.profile).toBeGreaterThanOrEqual(sizes.main - 1)
    expect(sizes.overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: testInfo.outputPath(`profile-ipad-landscape-${width}.png`) })
  }
})

test('keeps the first Profile and Schedule content clear of the header with Telegram top safe area', async ({ page }, testInfo) => {
  for (const { width, height } of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height })
    const syncSafeArea = async () => page.evaluate((viewportHeight) => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; contentSafeAreaInset: object; safeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = viewportHeight
      app.viewportStableHeight = viewportHeight
      app.contentSafeAreaInset = { top: 24, right: 0, bottom: 24, left: 0 }
      app.safeAreaInset = { top: 24, right: 0, bottom: 24, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('contentSafeAreaChanged')
    }, height)

    await page.goto('/#/profile')
    await syncSafeArea()
    const profileHeaderBottom = (await page.locator('header').boundingBox())!.y + (await page.locator('header').boundingBox())!.height
    const profileContentTop = (await page.locator('.profile-page > .eyebrow').boundingBox())!.y
    expect(profileContentTop, `Profile content overlaps header at ${width}×${height}`).toBeGreaterThanOrEqual(profileHeaderBottom)
    await page.screenshot({ path: testInfo.outputPath(`${width}-profile-safe-area.png`) })

    await page.goto('/#/schedule')
    await syncSafeArea()
    const schedulePage = page.locator('.schedule-page')
    if (!(await schedulePage.getByRole('combobox', { name: 'Найдите свою группу' }).count())) {
      await schedulePage.getByRole('button', { name: 'Изменить' }).click()
    }
    const groupSearch = schedulePage.getByRole('combobox', { name: 'Найдите свою группу' })
    if (await groupSearch.count()) {
      await groupSearch.fill('34б')
      await schedulePage.getByRole('button', { name: 'ИУ5-34Б' }).click()
    }
    const scheduleHeaderBottom = (await page.locator('header').boundingBox())!.y + (await page.locator('header').boundingBox())!.height
    const scheduleContentTop = (await page.locator('.schedule-group-heading').boundingBox())!.y
    expect(scheduleContentTop, `Schedule controls overlap header at ${width}×${height}`).toBeGreaterThanOrEqual(scheduleHeaderBottom)
    await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-safe-area.png`) })
  }
})

test('allows a keyboard user to choose a group and reports an unpublished schedule', async ({ page }) => {
  await page.goto('/#/schedule')
  const search = page.getByRole('combobox', { name: 'Найдите свою группу' })
  await search.fill('35б')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', { name: 'ИУ5-35Б' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('ИУ5-35Б', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Расписание пока не опубликовано' })).toBeVisible()
})

test('keeps mobile page scroll locked while schedule lessons scroll inside their list', async ({ page }, testInfo) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize({ width, height })
    const syncViewport = async () => page.evaluate((height) => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; contentSafeAreaInset: object; safeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = height
      app.viewportStableHeight = height
      app.contentSafeAreaInset = { top: 0, right: 0, bottom: 24, left: 0 }
      app.safeAreaInset = { top: 0, right: 0, bottom: 24, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('contentSafeAreaChanged')
    }, height)
    for (const route of ['/', '/profile', '/schedule']) {
      await page.goto(`/#${route}`)
      await syncViewport()
      await expect(page.locator('nav.bottom-nav')).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, 9999))
      expect(await page.evaluate(() => ({ y: scrollY, overflow: getComputedStyle(document.body).overflowY, horizontal: document.documentElement.scrollWidth > innerWidth }))).toEqual({ y: 0, overflow: 'hidden', horizontal: false })
      if (height === 844) {
        const main = await page.locator('main').evaluate((element) => ({ content: element.scrollHeight, viewport: element.clientHeight }))
        expect(main.content, `${route} main content exceeds its viewport at ${width}×${height}`).toBeLessThanOrEqual(main.viewport + 1)
      }
      const nav = await page.locator('nav.bottom-nav').boundingBox()
      expect(nav).toBeTruthy()
      expect(height - (nav!.y + nav!.height)).toBeGreaterThanOrEqual(24)
      await page.screenshot({ path: testInfo.outputPath(`${width}-${route === '/' ? 'home' : route.slice(1)}.png`) })
    }
    const picker = page.getByRole('combobox', { name: 'Найдите свою группу' })
    if (await picker.count()) {
      await picker.fill('34б')
      await page.getByRole('button', { name: 'ИУ5-34Б' }).click()
    }
    const dayPicker = page.getByRole('group', { name: 'Выбор даты' })
    await expect(dayPicker).toBeVisible()
    await dayPicker.locator('button').nth(2).click()
    await expect(page.getByRole('heading', { name: 'Физика' })).toBeVisible()
    await expect(page.locator('.schedule-meta')).toContainText('2026/2027 · осень')
    await page.locator('main').evaluate((element) => element.scrollTo(0, 9999))
    await page.evaluate(() => window.scrollTo(0, 9999))
    const weekMetrics = await page.locator('.schedule-lessons').evaluate((list) => {
      const main = document.querySelector('main')!
      const nav = document.querySelector('.bottom-nav')!
      const box = list.getBoundingClientRect()
      const cards = list.querySelectorAll('.schedule-lesson')
      const first = cards[0].getBoundingClientRect()
      const second = cards[1].getBoundingClientRect()
      return { bodyScroll: scrollY, mainScroll: main.scrollTop, mainContent: main.scrollHeight, mainViewport: main.clientHeight, count: cards.length, firstTop: first.top, listTop: box.top, secondBottom: second.bottom, visibleBottom: Math.min(box.bottom, nav.getBoundingClientRect().top - 4) }
    })
    expect(weekMetrics.bodyScroll).toBe(0)
    expect(weekMetrics.mainScroll).toBe(0)
    expect(weekMetrics.mainContent).toBeLessThanOrEqual(weekMetrics.mainViewport + 1)
    expect(weekMetrics.count).toBe(4)
    expect(weekMetrics.firstTop).toBeGreaterThanOrEqual(weekMetrics.listTop - 1)
    expect(weekMetrics.secondBottom, `Second lesson clipped at ${width}×${height}`).toBeLessThanOrEqual(weekMetrics.visibleBottom + 1)
    await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-date-selected.png`) })
    await dayPicker.locator('button').nth(3).click()
    const lessons = page.locator('.schedule-lessons')
    await expect(lessons.locator('.schedule-lesson')).toHaveCount(4)
    await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-selected.png`) })
    const metrics = await lessons.evaluate((list) => {
      const main = document.querySelector('main')!
      const heading = document.querySelector('.schedule-group-heading')!
      const nav = document.querySelector('.bottom-nav')!
      const cards = [...list.querySelectorAll('.schedule-lesson')]
      const box = list.getBoundingClientRect()
      const second = cards[1].getBoundingClientRect()
      const labelOverflows = cards.flatMap((card) => {
        const box = card.getBoundingClientRect()
        const style = getComputedStyle(card)
        const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
        const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight)
        return [...card.querySelectorAll<HTMLElement>('h2, p, small')].flatMap((label) => {
          const range = document.createRange()
          range.selectNodeContents(label)
          return [...range.getClientRects()].filter((rect) => rect.left < left - 1 || rect.right > right + 1).map((rect) => ({ text: label.textContent, left: rect.left, right: rect.right, contentLeft: left, contentRight: right }))
        })
      })
      return { overflow: getComputedStyle(list).overflowY, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, mainScrollHeight: main.scrollHeight, mainClientHeight: main.clientHeight, secondVisible: second.top < box.bottom && second.bottom <= box.bottom + 1, listBottom: box.bottom, navTop: nav.getBoundingClientRect().top, fitsViewport: heading.getBoundingClientRect().right <= innerWidth + 1 && box.right <= innerWidth + 1, labelsFit: labelOverflows.length === 0, labelOverflows }
    })
    expect(metrics.overflow).toBe('auto')
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    expect(metrics.secondVisible).toBe(true)
    expect(metrics.listBottom).toBeLessThanOrEqual(metrics.navTop - 4)
    expect(metrics.fitsViewport).toBe(true)
    expect(metrics.labelsFit, JSON.stringify(metrics.labelOverflows)).toBe(true)
    if (height === 844) {
      expect(metrics.mainScrollHeight).toBeLessThanOrEqual(metrics.mainClientHeight + 1)
      expect(metrics.clientHeight).toBeGreaterThan(304)
    }
    else if (metrics.mainScrollHeight > metrics.mainClientHeight + 1) {
      await page.locator('main').evaluate((element) => element.scrollTo(0, element.scrollHeight))
      expect(await page.locator('main').evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => scrollY)).toBe(0)
      await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-main-scrolled.png`) })
    }
    await lessons.evaluate((list) => list.scrollTo(0, list.scrollHeight))
    expect(await lessons.evaluate((list) => list.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-lessons-scrolled.png`) })
  }
})

test('keeps the landscape date picker fixed while only lessons scroll vertically', async ({ page }, testInfo) => {
  for (const width of [844, 850]) {
    await page.setViewportSize({ width, height: 390 })
    await page.goto('/#/schedule')
    await page.evaluate(() => {
      const app = (window as Window & { Telegram: { WebApp: { viewportHeight: number; viewportStableHeight: number; contentSafeAreaInset: object; safeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.viewportHeight = 390
      app.viewportStableHeight = 390
      app.contentSafeAreaInset = { top: 0, right: 0, bottom: 24, left: 0 }
      app.safeAreaInset = { top: 0, right: 0, bottom: 24, left: 0 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('contentSafeAreaChanged')
    })
    const picker = page.getByRole('combobox', { name: 'Найдите свою группу' })
    if (await picker.count()) {
      await picker.fill('34б')
      await page.getByRole('button', { name: 'ИУ5-34Б' }).click()
    }
    const days = page.getByRole('group', { name: 'Выбор даты' })
    await expect(days.locator('button')).toHaveCount(7)
    const alternateIndex = 2
    const lastDay = days.locator('button').last()
    await days.locator('button').nth(alternateIndex).click()
    await expect(page.getByRole('heading', { name: 'Физика' })).toBeVisible()
    const lessons = page.locator('.schedule-lessons')
    await expect(lessons.locator('.schedule-lesson')).toHaveCount(4)
    await lessons.evaluate((element) => element.scrollTo(0, 0))
    await page.evaluate(() => window.scrollTo(0, 9999))
    await page.locator('main').evaluate((element) => element.scrollTo(0, 9999))
    const metrics = await lessons.evaluate((list) => {
      const main = document.querySelector('main')!
      const nav = document.querySelector('.bottom-nav')!
      const days = document.querySelector('.schedule-days')!
      const box = list.getBoundingClientRect()
      const first = list.querySelector('.schedule-lesson')!.getBoundingClientRect()
      const dayBox = days.getBoundingClientRect()
      const dayButton = days.querySelector('button')!.getBoundingClientRect()
      return { bodyScroll: scrollY, mainScroll: main.scrollTop, mainContent: main.scrollHeight, mainViewport: main.clientHeight, listContent: list.scrollHeight, listViewport: list.clientHeight, listBottom: box.bottom, navTop: nav.getBoundingClientRect().top, navBottom: nav.getBoundingClientRect().bottom, firstBottom: first.bottom, dayOverflowX: getComputedStyle(days).overflowX, dayOverflowY: getComputedStyle(days).overflowY, dayScrollbarWidth: getComputedStyle(days).scrollbarWidth, dayWidth: days.clientWidth, dayContent: days.scrollWidth, dayHeight: dayBox.height, dayBottom: dayBox.bottom, dayButtonHeight: dayButton.height, dayButtonBottom: dayButton.bottom, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }
    })
    expect(metrics.bodyScroll).toBe(0)
    expect(metrics.mainScroll).toBe(0)
    expect(metrics.mainContent).toBeLessThanOrEqual(metrics.mainViewport + 1)
    expect(metrics.listContent).toBeGreaterThan(metrics.listViewport)
    expect(metrics.listViewport).toBeGreaterThanOrEqual(44)
    expect(metrics.listBottom).toBeLessThanOrEqual(metrics.navTop - 4)
    expect(390 - metrics.navBottom).toBeGreaterThanOrEqual(24)
    expect(metrics.horizontalOverflow).toBe(false)
    expect(metrics.dayHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.dayOverflowY).toBe('hidden')
    expect(metrics.dayScrollbarWidth).toBe('none')
    expect(metrics.dayButtonHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.dayButtonBottom).toBeLessThanOrEqual(metrics.dayBottom + 1)
    await expect(page.locator('nav.bottom-nav')).toBeVisible()
    if (width === 844) {
      const accessibility = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
      expect(accessibility.violations).toEqual([])
    }
    await page.screenshot({ path: testInfo.outputPath(`${width}-week-landscape.png`) })
    await lessons.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    expect(await lessons.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`${width}-week-landscape-scrolled.png`) })
    await lastDay.scrollIntoViewIfNeeded()
    await lastDay.click()
    await expect(lastDay).toHaveAttribute('aria-pressed', 'true')
  }
})
