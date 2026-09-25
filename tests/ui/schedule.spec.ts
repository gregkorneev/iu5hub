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
  await expect(page.getByText(/2026\/2027 · осень/)).toBeVisible()
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
