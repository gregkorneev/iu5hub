import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import worker from '../src/index.mjs'
import { buildScheduleDay, buildScheduleWeek, scheduleWidgetHtml } from '../src/schedule-widget.mjs'
import { hashTelegramUserId } from '../src/telegram.mjs'

const group = { id: 'iu5-34b', name: 'ИУ5-34Б' }
const baseSchedule = {
  group, source: { syncedAt: '2026-11-01T00:00:00.000Z' }, semester: { weekOneStart: '2026-08-31' }, availability: 'available',
  days: {
    '2026-11-09': [{ start: '09:50', end: '11:20', subject: 'Алгоритмы', type: 'Лекция', teacher: '', location: '' }],
    '2026-11-10': [{ start: '11:50', end: '13:20', subject: 'Парадигмы языков программирования', type: 'Практика', teacher: 'Иванов И. И.', location: 'ГУК, 513ю' }],
    '2026-11-15': [{ start: '14:05', end: '15:35', subject: 'Тест воскресного перехода', type: 'Лекция', teacher: 'Петров П. П.', location: 'Ауд. 2' }],
  },
}
const env = { TELEGRAM_WEBHOOK_SECRET: 'hook-secret', TELEGRAM_BOT_TOKEN: 'beta-token', USER_ID_HMAC_SECRET: 'beta-hmac-secret', ANALYTICS_DB: null }

class FakeDb {
  constructor(row = { groupId: group.id }) { this.row = row; this.owner = null; this.receipts = new Set() }
  prepare(sql) {
    return { bind: (...values) => ({
      first: async () => {
        if (sql.includes('profile_preferences')) { this.owner = values[0]; return this.row }
        return null
      },
      run: async () => {
        if (sql.includes('telegram_update_receipts')) {
          const before = this.receipts.size
          this.receipts.add(values[0])
          return { meta: { changes: this.receipts.size - before } }
        }
        return { meta: { changes: 1 } }
      },
    }) }
  }
}
function request(body) {
  return new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'hook-secret', 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
function incoming(text, { id = 4242, chat = id, type = 'private', updateId = 10 } = {}) {
  return { update_id: updateId, message: { text, from: { id }, chat: { id: chat, type }, message_id: 987 } }
}
async function mockFetch(t, handler) {
  const original = globalThis.fetch
  globalThis.fetch = handler
  t.after(() => { globalThis.fetch = original })
}

test('today and tomorrow return selected Moscow calendar dates and whole lesson fields', () => {
  const today = buildScheduleDay(group, baseSchedule, '2026-11-10')
  assert.equal(today.d, '2026-11-10')
  assert.equal(today.w, 11)
  assert.equal(today.p, 'Числитель')
  assert.deepEqual(today.l[0], { s: '11:50', e: '13:20', n: 'Парадигмы языков программирования', t: 'Практика', p: 'Иванов И. И.', a: 'ГУК, 513ю' })
  assert.deepEqual(buildScheduleDay(group, baseSchedule, '2026-11-11').l, [])
})

test('week view is Monday through Sunday and date selection crosses Sunday correctly', () => {
  const week = buildScheduleWeek(group, baseSchedule, '2026-11-15')
  assert.deepEqual(week.l.map((day) => day[1]), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  assert.equal(week.l[6][2], 1)
  assert.equal(buildScheduleDay(group, baseSchedule, '2026-11-16').w, 12)
  assert.equal(buildScheduleDay(group, baseSchedule, '2026-12-31').d, '2026-12-31')
  assert.equal(buildScheduleDay(group, baseSchedule, '2027-01-01').d, '2027-01-01')
})

test('empty day, unpublished data, absent teacher/room, and out-of-range dates are distinct', () => {
  assert.deepEqual(buildScheduleDay(group, baseSchedule, '2026-11-12').l, [])
  assert.equal(buildScheduleDay(group, baseSchedule, '2026-11-12').x, undefined)
  const unpublished = { ...baseSchedule, availability: 'unavailable', days: {} }
  assert.equal(buildScheduleDay(group, unpublished, '2026-11-12').x, 'unpublished')
  const lesson = buildScheduleDay(group, baseSchedule, '2026-11-09').l[0]
  assert.equal(lesson.n, 'Алгоритмы')
  assert.equal(Object.hasOwn(lesson, 'p'), false)
  assert.equal(Object.hasOwn(lesson, 'a'), false)
  assert.deepEqual(buildScheduleDay(group, baseSchedule, '2028-01-01').l, [])
})

test('long subjects remain intact and large days are paged within the 1024-byte answer limit', () => {
  const longSchedule = { ...baseSchedule, days: { '2026-11-10': Array.from({ length: 6 }, (_, i) => ({ start: '09:50', end: '11:20', subject: `Название дисциплины ${i} `.repeat(15), type: 'Практическое занятие', teacher: `Преподаватель ${i}`, location: 'Аудитория 123, главный учебный корпус' })) } }
  const first = buildScheduleDay(group, longSchedule, '2026-11-10')
  assert.ok(first.c > 1)
  assert.ok(first.l.length <= 4)
  assert.equal(JSON.stringify(first).includes('Название дисциплины 0'), true)
  assert.ok(new TextEncoder().encode(JSON.stringify(first)).byteLength <= 1024)
  const second = buildScheduleDay(group, longSchedule, '2026-11-10', 1)
  assert.equal(second.i, 1)
  assert.ok(second.l[0].n.length > 100)
})

test('widget HTML fits Bot API limits, zlib level 9, uses theme variables and sends only on taps', () => {
  const html = scheduleWidgetHtml()
  assert.ok(new TextEncoder().encode(html).byteLength <= 32_768)
  assert.ok(deflateSync(Buffer.from(html, 'utf8'), { level: 9 }).byteLength <= 4096)
  assert.match(html, /--tg-theme-/)
  assert.match(html, /chatDataChanged/)
  assert.match(html, /TelegramWidget\.request\(action\)/)
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest/)
})

test('/schedule and schedule button send silent widgets with the selected HMAC-owned Beta group', async (t) => {
  const db = new FakeDb()
  const expectedHash = await hashTelegramUserId('4242', env.USER_ID_HMAC_SECRET)
  const calls = []
  await mockFetch(t, async (url, init) => {
    if (String(url).includes('beta.iu5hub.pages.dev')) {
      const path = new URL(url).pathname
      if (path.endsWith('groups.json')) return Response.json({ groups: [{ ...group, hasSchedule: true }] })
      return Response.json(baseSchedule)
    }
    const body = JSON.parse(init.body)
    calls.push({ method: String(url).split('/').at(-1), body })
    return Response.json({ ok: true, result: { message_id: 456 } })
  })
  const runtime = { ...env, ANALYTICS_DB: db }
  for (const [text, updateId] of [['/schedule', 10], ['📅 Расписание', 11]]) {
    const result = await worker.fetch(request(incoming(text, { updateId })), runtime)
    assert.equal(result.status, 200)
  }
  assert.equal(db.owner, expectedHash)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(({ method, body }) => method === 'sendWidget' && body.disable_notification === true && body.allow_queries === true && body.is_shared === undefined))
  assert.equal(JSON.parse(calls[0].body.chat_data).g, group.name)
  assert.equal(calls[0].body.chat_data.length <= 1024, true)
})

test('group chat requests are ignored and no-group/missing-group cases offer the Beta app', async (t) => {
  const calls = []
  await mockFetch(t, async (url, init) => {
    if (String(url).includes('beta.iu5hub.pages.dev')) return Response.json({ groups: [{ ...group, hasSchedule: true }] })
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    return Response.json({ ok: true, result: true })
  })
  const runtime = { ...env, ANALYTICS_DB: new FakeDb() }
  await worker.fetch(request(incoming('/schedule', { chat: -100, type: 'supergroup' })), runtime)
  assert.equal(calls.length, 0)
  await worker.fetch(request(incoming('📅 Расписание')), { ...runtime, ANALYTICS_DB: new FakeDb(null) })
  assert.equal(calls[0].body.text, 'Сначала выберите учебную группу в приложении «Студент ИУ5».')
  assert.equal(calls[0].body.disable_notification, true)
  assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://beta.iu5hub.pages.dev/#/schedule')
  await worker.fetch(request(incoming('/schedule')), { ...runtime, ANALYTICS_DB: new FakeDb({ groupId: 'iu5-gone' }) })
  assert.match(calls[1].body.text, /больше не доступна/)
})

test('schedule query validates action and private owner, answers with data, and never sends another chat message', async (t) => {
  const db = new FakeDb()
  const calls = []
  await mockFetch(t, async (url, init) => {
    if (String(url).includes('beta.iu5hub.pages.dev')) return String(url).endsWith('groups.json') ? Response.json({ groups: [{ ...group, hasSchedule: true }] }) : Response.json(baseSchedule)
    calls.push({ method: String(url).split('/').at(-1), body: JSON.parse(init.body) })
    return Response.json({ ok: true, result: true })
  })
  const update = (data, user = 4242, chat = user) => ({ update_id: 20, widget_query: { id: 'widget-query-12345', from: { id: user }, chat: { id: chat, type: 'private' }, message_id: 456, data } })
  await worker.fetch(request(update('tomorrow')), { ...env, ANALYTICS_DB: db })
  assert.equal(calls[0].method, 'answerWidgetQuery')
  const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const today = `${todayParts.find((part) => part.type === 'year').value}-${todayParts.find((part) => part.type === 'month').value}-${todayParts.find((part) => part.type === 'day').value}`
  const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  assert.equal(JSON.parse(calls[0].body.data).d, tomorrow.toISOString().slice(0, 10))
  await worker.fetch(request(update('bogus')), { ...env, ANALYTICS_DB: db })
  assert.equal(calls[1].method, 'answerWidgetQuery')
  assert.equal(JSON.parse(calls[1].body.data).e, 'retry')
  await worker.fetch(request(update('today', 4242, -1)), { ...env, ANALYTICS_DB: db })
  assert.equal(calls.length, 3)
  await worker.fetch(request(update('day:2020-01-01')), { ...env, ANALYTICS_DB: db })
  assert.equal(JSON.parse(calls[3].body.data).e, 'retry')
})

test('webhook secret is required before widget updates are processed', async () => {
  const result = await worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', body: JSON.stringify(incoming('/schedule')) }), env)
  assert.equal(result.status, 401)
})

test('schedule data load has a fixed Beta origin and validates unknown response groups', async (t) => {
  const db = new FakeDb()
  const calls = []
  await mockFetch(t, async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('groups.json')) return Response.json({ groups: [{ id: 'iu5-other', name: 'ИУ5-Х', hasSchedule: true }] })
    return Response.json(baseSchedule)
  })
  await worker.fetch(request(incoming('/schedule')), { ...env, ANALYTICS_DB: db })
  assert.equal(calls.filter((url) => url.startsWith('https://beta.iu5hub.pages.dev/')).length, 1)
  assert.equal(calls[0].startsWith('https://beta.iu5hub.pages.dev/'), true)
})

test('replayed Telegram schedule update does not create a second widget', async (t) => {
  const db = new FakeDb()
  const calls = []
  await mockFetch(t, async (url, init) => {
    if (String(url).includes('beta.iu5hub.pages.dev')) return String(url).endsWith('groups.json') ? Response.json({ groups: [{ ...group, hasSchedule: true }] }) : Response.json(baseSchedule)
    calls.push(JSON.parse(init.body))
    return Response.json({ ok: true, result: { message_id: 123 } })
  })
  const runtime = { ...env, ANALYTICS_DB: db }
  await worker.fetch(request(incoming('/schedule', { updateId: 99 })), runtime)
  await worker.fetch(request(incoming('/schedule', { updateId: 99 })), runtime)
  assert.equal(calls.length, 1)
})

test('Telegram widget API failure gets one silent fallback and safe logs', async (t) => {
  const calls = []
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  t.after(() => { console.error = originalError })
  await mockFetch(t, async (url, init) => {
    if (String(url).includes('beta.iu5hub.pages.dev')) return String(url).endsWith('groups.json') ? Response.json({ groups: [{ ...group, hasSchedule: true }] }) : Response.json(baseSchedule)
    const method = String(url).split('/').at(-1)
    calls.push({ method, body: JSON.parse(init.body) })
    return method === 'sendWidget'
      ? Response.json({ ok: false, error_code: 400, description: 'bot-token-must-not-be-logged' })
      : Response.json({ ok: true, result: { message_id: 999 } })
  })
  await worker.fetch(request(incoming('/schedule', { updateId: 123 })), { ...env, ANALYTICS_DB: new FakeDb() })
  assert.deepEqual(calls.map((call) => call.method), ['sendWidget', 'sendMessage'])
  assert.equal(calls[1].body.disable_notification, true)
  assert.doesNotMatch(JSON.stringify(errors), /bot-token|beta-token/)
})

test('published group JSON fixture contains expected lesson shape for rendering', async () => {
  const schedule = JSON.parse(await readFile(new URL('../../public/data/schedule/groups/iu5-34b.json', import.meta.url), 'utf8'))
  assert.equal(schedule.group.id, group.id)
  assert.equal(schedule.availability, 'available')
  const lessons = Object.values(schedule.days).flat()
  assert.ok(lessons.length > 0)
  assert.ok(lessons.every((item) => item.subject && item.start && item.end && typeof item.teacher === 'string' && typeof item.location === 'string'))
})
