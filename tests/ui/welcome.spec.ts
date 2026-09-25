import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

test.use({ welcomeComplete: false })

test('introduces Catalog, Search and Schedule once, then opens the app on reload', async ({ page }, testInfo) => {
  await page.goto('/#/')
  const dialog = page.locator('dialog.welcome-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Материалы по курсам' })).toBeVisible()
  await expect(dialog.getByText('Первый запуск · 1 из 3')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Далее' })).toBeFocused()
  const accessibility = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  expect(accessibility.violations).toEqual([])
  if (testInfo.project.name === 'chromium') {
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Пропустить' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Далее' })).toBeFocused()
  }
  await dialog.getByRole('button', { name: 'Далее' }).click()
  await expect(dialog.getByRole('heading', { name: 'Быстрый поиск' })).toBeVisible()
  await expect(dialog.getByText('Первый запуск · 2 из 3')).toBeVisible()
  await page.evaluate(() => { location.hash = '#/search' })
  await expect(page).toHaveURL(/#\/search$/)
  await expect(dialog.getByRole('heading', { name: 'Быстрый поиск' })).toBeVisible()
  await page.evaluate(() => { location.hash = '#/' })
  await dialog.getByRole('button', { name: 'Далее' }).click()
  await expect(dialog.getByRole('heading', { name: 'Расписание под рукой' })).toBeVisible()
  await expect(dialog.getByText('Первый запуск · 3 из 3')).toBeVisible()
  await dialog.getByRole('button', { name: 'Начать' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('iu5hub:welcome:v1'))).toBe('done')
  await page.reload()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Студент ИУ5', level: 1 })).toBeVisible()
})

test('Skip preserves a direct deep link and normal BackButton resumes after dismissal', async ({ page }) => {
  await page.goto('/#/course/course-1?path=1%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80')
  const url = page.url()
  const dialog = page.locator('dialog.welcome-dialog')
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { __telegram: { visible: boolean } }).__telegram.visible)).toBe(false)
  await page.evaluate(() => (window as Window & { Telegram: { WebApp: { BackButton: { trigger(): void } } } }).Telegram.WebApp.BackButton.trigger())
  expect(page.url()).toBe(url)
  await dialog.getByRole('button', { name: 'Пропустить' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(url)
  await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { visible: boolean } }).__telegram.visible)).toBe(true)
  await page.reload()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(url)
})

test('Escape dismisses and remembers the choice', async ({ page }) => {
  await page.goto('/#/profile')
  const dialog = page.locator('dialog.welcome-dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('iu5hub:welcome:v1'))).toBe('done')
  await page.reload()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/#\/profile$/)
})

test('stays within a short Telegram safe area and follows its dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/')
  await page.evaluate(() => {
    const app = (window as Window & { Telegram: { WebApp: { colorScheme: string; themeParams: Record<string, string>; viewportHeight: number; contentSafeAreaInset: object } }; __telegramEmit: (event: string) => void }).Telegram.WebApp
    app.colorScheme = 'dark'
    app.themeParams = { bg_color: '#101820', text_color: '#f3f8ff', button_color: '#78b4ff' }
    app.viewportHeight = 568
    app.contentSafeAreaInset = { top: 24, right: 0, bottom: 24, left: 0 }
    ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('themeChanged')
    ;(window as Window & { __telegramEmit: (event: string) => void }).__telegramEmit('viewportChanged')
  })
  const dialog = page.locator('dialog.welcome-dialog')
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.telegramTheme)).toBe('dark')
  const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  expect(contrast.violations).toEqual([])
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(24)
  expect(box!.y + box!.height).toBeLessThanOrEqual(568 - 24)
  for (const button of await dialog.getByRole('button').all()) {
    const target = await button.boundingBox()
    expect(target && target.height >= 44 && target.width >= 44).toBe(true)
  }
})
