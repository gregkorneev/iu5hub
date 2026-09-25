import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

test('selects a group, shows today and week schedule, and keeps four-tab navigation at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/#/schedule')
  const nav = page.getByRole('navigation', { name: 'Основная навигация' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  await expect(nav.getByRole('link', { name: 'Расписание' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.bottom-touch-bar').getByRole('button', { name: '← Назад' })).toHaveCount(0)
  const geometry = await nav.evaluate((element) => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth, links: [...element.querySelectorAll('a')].map((link) => ({ width: link.clientWidth, height: link.clientHeight, text: link.scrollWidth <= link.clientWidth })) }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width)
  expect(geometry.links.every((item) => item.width >= 44 && item.height >= 44 && item.text)).toBeTruthy()

  const search = page.getByRole('combobox', { name: 'Найдите свою группу' })
  await expect(search).toBeVisible()
  await search.fill('34б')
  await page.getByRole('button', { name: 'ИУ5-34Б' }).click()
  await expect(page.getByRole('heading', { name: 'Электротехника' })).toBeVisible()
  await expect(page.getByText('Сейчас')).toBeVisible()
  await page.getByRole('button', { name: 'Неделя' }).click()
  await expect(page.getByRole('group', { name: 'Дни недели' })).toBeVisible()
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
    if (height === 844) {
      await page.getByRole('button', { name: 'Неделя' }).click()
      await expect(page.getByRole('group', { name: 'Дни недели' })).toBeVisible()
      await expect(page.locator('.schedule-meta')).toBeVisible()
      const weekMain = await page.locator('main').evaluate((element) => ({ content: element.scrollHeight, viewport: element.clientHeight }))
      expect(weekMain.content).toBeLessThanOrEqual(weekMain.viewport + 1)
      await page.screenshot({ path: testInfo.outputPath(`${width}-schedule-week.png`) })
      await page.getByRole('button', { name: 'Сегодня' }).click()
    }
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
      return { overflow: getComputedStyle(list).overflowY, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, mainScrollHeight: main.scrollHeight, mainClientHeight: main.clientHeight, secondVisible: second.top < box.bottom && second.bottom <= box.bottom + 1, listBottom: box.bottom, navTop: nav.getBoundingClientRect().top, fitsViewport: heading.getBoundingClientRect().right <= innerWidth + 1 && box.right <= innerWidth + 1, labelsFit: cards.every((card) => card.scrollWidth <= card.clientWidth + 1 && [...card.querySelectorAll('h2, p, small')].every((label) => label.scrollWidth <= label.clientWidth + 1)) }
    })
    expect(metrics.overflow).toBe('auto')
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    expect(metrics.secondVisible).toBe(true)
    expect(metrics.listBottom).toBeLessThanOrEqual(metrics.navTop - 4)
    expect(metrics.fitsViewport).toBe(true)
    expect(metrics.labelsFit).toBe(true)
    if (height === 844) expect(metrics.mainScrollHeight).toBeLessThanOrEqual(metrics.mainClientHeight + 1)
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
