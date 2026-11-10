import { expect, test } from '@playwright/test'
import { scheduleWidgetHtml } from '../../worker/src/schedule-widget.mjs'

const today = { v: 'd', k: 'today', g: 'ИУ5-34Б', d: '2026-11-10', w: 11, p: 'Числитель', u: '2026-11-01', i: 0, c: 1, l: [{ s: '09:50', e: '11:20', n: 'Сегодняшняя пара', t: 'Лекция' }] }
const tomorrow = { ...today, k: 'tomorrow', d: '2026-11-11', l: [{ s: '11:50', e: '13:20', n: 'Завтрашняя пара', t: 'Практика', p: 'Иванов И. И.', a: 'ГУК 513ю' }] }
const week = { v: 'w', k: 'week', g: 'ИУ5-34Б', d: '2026-11-10', w: 11, p: 'Числитель', u: '2026-11-01', l: [['Пн', '2026-11-09', 1, '09:50'], ['Вт', '2026-11-10', 1, '09:50'], ['Ср', '2026-11-11', 0, ''], ['Чт', '2026-11-12', 2, '11:50'], ['Пт', '2026-11-13', 0, ''], ['Сб', '2026-11-14', 0, ''], ['Вс', '2026-11-15', 1, '14:05']] }
const selectedDay = { ...today, k: 'day', d: '2026-11-12', b: 1, l: [{ s: '11:50', e: '13:20', n: 'Выбранный день', t: 'Лабораторная' }] }

test.describe('Telegram Schedule Widget sandbox UI', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one DOM runtime pass covers the standalone HTML widget')

  async function openWidget(page, answers = { today, tomorrow, week, 'day:2026-11-12': selectedDay }) {
    await page.setViewportSize({ width: 320, height: 700 })
    const runtime = `<script>window.__widgetRequests=[];window.__widgetAnswers=${JSON.stringify(answers)};window.TelegramWidget={chatData:${JSON.stringify(JSON.stringify(today))},onEvent:()=>{},request:(action)=>{window.__widgetRequests.push(action);return Promise.resolve({result:JSON.stringify(window.__widgetAnswers[action])})}};</script>`
    await page.setContent(scheduleWidgetHtml().replace('<body>', `<body>${runtime}`))
  }

  test('switches today, tomorrow, week and a selected day inside one widget', async ({ page }) => {
    await openWidget(page)
    await expect(page.getByText('Сегодняшняя пара')).toBeVisible()
    await page.getByRole('button', { name: 'Завтра' }).click()
    await expect(page.getByText('Завтрашняя пара')).toBeVisible()
    await page.getByRole('button', { name: 'Неделя' }).click()
    await expect(page.getByText('Чт · 12 ноября')).toBeVisible()
    await page.getByRole('button', { name: /Чт · 12 ноября/ }).click()
    await expect(page.getByText('Выбранный день')).toBeVisible()
    await page.getByRole('button', { name: '← К неделе' }).click()
    await expect(page.getByText('Вс · 15 ноября')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __widgetRequests: string[] }).__widgetRequests)).toEqual(['tomorrow', 'week', 'day:2026-11-12', 'week'])
  })

  test('allows only one in-flight request and restores a retry after a failed request', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    const answer = JSON.stringify({ ...today, k: 'tomorrow', d: '2026-11-11', l: [{ s: '11:50', e: '13:20', n: 'Повтор после ошибки', t: 'Практика' }] })
    const runtime = `<script>window.__widgetRequests=[];window.TelegramWidget={chatData:${JSON.stringify(JSON.stringify(today))},onEvent:()=>{},request:(action)=>{window.__widgetRequests.push(action);if(window.__widgetRequests.length===1)return new Promise(resolve=>setTimeout(()=>resolve({result:${JSON.stringify(answer)}}),100));if(window.__widgetRequests.length===2)return Promise.reject(Object.assign(new Error('timeout'),{code:'TIMEOUT'}));return Promise.resolve({result:${JSON.stringify(answer)}})}};</script>`
    await page.setContent(scheduleWidgetHtml().replace('<body>', `<body>${runtime}`))
    const tomorrowButton = page.locator('button[data-action="tomorrow"]')
    await tomorrowButton.click()
    await expect(page.getByRole('button', { name: 'Загрузка…' })).toBeDisabled()
    await tomorrowButton.click({ force: true })
    await expect(page.getByText('Повтор после ошибки')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __widgetRequests: string[] }).__widgetRequests)).toEqual(['tomorrow'])
    await tomorrowButton.click()
    await expect(page.getByText('Не удалось обновить. Нажмите ещё раз.')).toBeVisible()
    await tomorrowButton.click()
    await expect(page.getByText('Повтор после ошибки')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __widgetRequests: string[] }).__widgetRequests)).toEqual(['tomorrow', 'tomorrow', 'tomorrow'])
  })
})
