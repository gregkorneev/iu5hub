import { test, expect } from './fixtures'

test.describe('Студент ИУ5 mobile resilience', () => {
  test('keeps every course reachable on a small iPhone with a long Telegram name', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/')
    await expect(page.getByRole('link', { name: /Курс 3/ })).toBeVisible()
    expect(await page.getByRole('link', { name: /Курс 3/ }).evaluate((link) => {
      const bottom = link.getBoundingClientRect().bottom
      if (bottom <= innerHeight) return true
      for (let node: Element | null = link; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node)
        if (/^(auto|scroll)$/.test(overflowY) && node.scrollHeight > node.clientHeight) return true
      }
      return false
    })).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  })

  test('reacts to Telegram theme and safe-area events without losing the route or search text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/search')
    const input = page.getByRole('searchbox', { name: 'Поиск в папках и файлах' })
    await input.fill('мат')
    await page.evaluate(() => {
      const app = (window as Window & { Telegram: { WebApp: { themeParams: Record<string, string>; colorScheme: string; viewportHeight: number; contentSafeAreaInset: Record<string, number> } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
      app.themeParams = { bg_color: '#101820', text_color: '#f4f7fa', secondary_bg_color: '#182633', button_color: '#78b4ff', button_text_color: '#102333' }
      app.colorScheme = 'dark'
      app.viewportHeight = 780
      app.contentSafeAreaInset = { top: 24, right: 12, bottom: 34, left: 12 }
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('themeChanged')
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
      ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('contentSafeAreaChanged')
    })
    await expect(input).toHaveValue('мат')
    await expect(page).toHaveURL(/#\/search$/)
    expect(await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const app = getComputedStyle(document.querySelector('.app')!)
      return root.getPropertyValue('--platform-background').trim() === '#101820'
        && root.getPropertyValue('--platform-text').trim() === '#f4f7fa'
        && root.getPropertyValue('--tg-viewport-height').trim() === '780px'
        && root.getPropertyValue('--tg-safe-area-bottom').trim() === '34px'
        && root.getPropertyValue('--telegram-button-text-color').trim() === '#102333'
        && getComputedStyle(document.querySelector('.search button')!).color === 'rgb(16, 35, 51)'
        && parseFloat(app.paddingTop) >= 24
        && parseFloat(app.paddingBottom) >= 34
        && parseFloat(app.paddingLeft) >= 12
        && parseFloat(app.paddingRight) >= 12
        && document.documentElement.scrollWidth <= innerWidth
    })).toBeTruthy()
  })

  test('replaces movement and translucent chrome for accessibility preferences', async ({ page, browserName }) => {
    await page.goto('/#/course/course-1')
    await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
    expect(await page.evaluate(() => {
      const main = getComputedStyle(document.querySelector('main')!)
      const card = getComputedStyle(document.querySelector('.semester-button')!)
      const header = getComputedStyle(document.querySelector('header')!)
      return matchMedia('(prefers-reduced-motion: reduce)').matches
        && matchMedia('(prefers-contrast: more)').matches
        && main.animationName === 'page-fade'
        && card.borderTopWidth !== '0px'
        && header.backdropFilter === 'none'
    })).toBeTruthy()
    if (browserName === 'chromium') {
      const session = await page.context().newCDPSession(page)
      await session.send('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-contrast', value: 'more' },
        { name: 'prefers-reduced-transparency', value: 'reduce' },
      ] })
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches
        && getComputedStyle(document.querySelector('header')!).backdropFilter === 'none')).toBeTruthy()
    }
  })
})
