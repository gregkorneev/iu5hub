import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

test.describe('Student Hub critical UI', () => {
  test('starts in Telegram, exposes courses, and has no serious accessibility violations', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Материалы на Яндекс.Диске' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Курс 1/ })).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { ready: number } }).__telegram.ready)).toBe(1)
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([])
    expect(consoleErrors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
  })

  test('navigates folders, downloads an allowlisted file, and keeps no horizontal overflow', async ({ page }) => {
    await page.goto('/#/course/course-1')
    await page.getByRole('link', { name: /1 семестр/ }).click()
    await expect(page.getByRole('button', { name: 'Лекция 1.pdf Скачать файл' })).toBeVisible()
    const downloadCall = page.waitForRequest((request) => request.url().includes('/download'))
    await page.getByRole('button', { name: /Скачать Лекция 1.pdf/ }).click()
    await downloadCall
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
  })

  test('searches Russian text, handles no results and clears stale suggestions', async ({ page }) => {
    await page.goto('/#/search')
    const input = page.getByRole('searchbox', { name: 'Поиск в папках и файлах' })
    await input.fill('мат')
    await expect(page.getByLabel('Подсказки поиска')).toContainText('Математический анализ')
    await input.fill('x')
    await expect(page.getByLabel('Подсказки поиска')).toBeHidden()
    await input.fill('несуществующий материал')
    await input.press('Enter')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
  })

  test('supports direct hash routes and Telegram BackButton navigation', async ({ page }) => {
    await page.goto('/#/course/course-1')
    await expect.poll(() => page.evaluate(() => (window as Window & { __telegram: { visible: boolean } }).__telegram.visible)).toBe(true)
    await page.getByRole('link', { name: /Математический анализ/ }).click()
    await page.evaluate(() => (window as Window & { Telegram: { WebApp: { BackButton: { trigger(): void } } } }).Telegram.WebApp.BackButton.trigger())
    await expect(page).toHaveURL(/course\/course-1$/)
    await page.goto('/#/course/not-real')
    await expect(page.getByRole('heading', { name: 'Курс не найден' })).toBeVisible()
  })

  test('renders the narrow mobile layout without overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/course/course-1')
    await expect(page.getByRole('heading', { name: 'Курс 1' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('course-mobile.png'), fullPage: true })
  })
})
