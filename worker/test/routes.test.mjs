import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import worker from '../src/index.mjs'

const token = '123456:token-for-test-only'
const now = Math.floor(Date.now() / 1000)

function signedInitData(userId) {
  const params = new URLSearchParams({ auth_date: String(now), user: JSON.stringify({ id: userId }) })
  const check = [...params].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
  return params.toString()
}

const env = { ANALYTICS_HMAC_SECRET: 'server-only-secret', TELEGRAM_BOT_TOKEN: token, ADMIN_TELEGRAM_IDS: '1', TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' }

class FakeDb {
  users = new Map()
  events = []

  prepare(sql) {
    return { bind: (...values) => ({ run: async () => this.execute(sql, values), first: async () => this.first(sql, values), all: async () => ({ results: [] }) }) }
  }

  async batch(statements) { for (const statement of statements) await statement.run() }

  execute(sql, values) {
    if (sql.includes('INSERT INTO users')) {
      const [hash, firstSeen, lastSeen, duplicateHash, minute] = values
      const appOpen = sql.includes('VALUES (?, ?, ?, 1)')
      const duplicate = appOpen && this.events.some((event) => event.userHash === duplicateHash && event.type === 'app_open' && event.minute === minute)
      const user = this.users.get(hash)
      this.users.set(hash, user ? { ...user, lastSeen, launches: user.launches + Number(appOpen && !duplicate) } : { firstSeen, lastSeen, launches: Number(appOpen) })
      return
    }
    const appOpen = sql.includes("'app_open'")
    const [userHash, type = 'app_open', subjectId = '', materialId = '', minute, createdAt] = appOpen ? [values[0], 'app_open', '', '', values[1], values[2]] : values
    if (!this.events.some((event) => event.userHash === userHash && event.type === type && event.subjectId === subjectId && event.materialId === materialId && event.minute === minute)) this.events.push({ userHash, type, subjectId, materialId, minute, createdAt })
  }

  first(sql, [start]) {
    if (sql === 'SELECT COUNT(*) AS count FROM users') return { count: this.users.size }
    if (sql.includes('COUNT(DISTINCT user_hash)')) return { count: new Set(this.events.filter((event) => event.createdAt >= start).map((event) => event.userHash)).size }
    const type = sql.match(/event_type = '([^']+)'/)?.[1]
    return { count: this.events.filter((event) => event.type === type && event.createdAt >= start).length }
  }
}

test('does not expose admin status without verified initData', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/admin/me'), env)
  assert.equal(response.status, 401)
})

test('returns admin status only from a signed Telegram user and blocks direct stats access', async () => {
  const headers = { 'X-Telegram-Init-Data': signedInitData(2) }
  const me = await worker.fetch(new Request('https://worker.example/api/admin/me', { headers }), env)
  assert.deepEqual(await me.json(), { isAdmin: false })
  const stats = await worker.fetch(new Request('https://worker.example/api/admin/stats/summary', { headers }), env)
  assert.equal(stats.status, 403)
})

test('rejects Telegram webhook calls without its secret header', async () => {
  const response = await worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', body: '{}' }), env)
  assert.equal(response.status, 401)
})

test('permits the Mini App origin to preflight its authenticated API request', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/analytics/open', { method: 'OPTIONS', headers: { Origin: 'https://iu5hub.pages.dev' } }), env)
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, X-Telegram-Init-Data')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://iu5hub.pages.dev')
})

test('D1 flow keeps one launch and search per minute but keeps distinct material opens', async () => {
  const db = new FakeDb()
  const headers = { 'X-Telegram-Init-Data': signedInitData(1), 'content-type': 'application/json' }
  const request = (path, body) => worker.fetch(new Request(`https://worker.example${path}`, { method: 'POST', headers, body }), { ...env, ANALYTICS_DB: db })
  await request('/api/analytics/open'); await request('/api/analytics/open')
  await request('/api/analytics/event', JSON.stringify({ type: 'search' })); await request('/api/analytics/event', JSON.stringify({ type: 'search' }))
  await request('/api/analytics/event', JSON.stringify({ type: 'material_open', subjectId: 'math', materialId: '/Математика/1.pdf' }))
  await request('/api/analytics/event', JSON.stringify({ type: 'material_open', subjectId: 'math', materialId: '/Математика/2.pdf' }))
  const response = await worker.fetch(new Request('https://worker.example/api/admin/stats/summary?period=today', { headers }), { ...env, ANALYTICS_DB: db })
  assert.deepEqual(await response.json(), { period: 'today', users: { total: 1, today: 1, days7: 1, days30: 1 }, launches: 1, activity: { searches: 1, materialOpens: 2, yandexDiskOpens: 0 } })
})

test('an event arriving before app open creates its user without inflating launches', async () => {
  const db = new FakeDb()
  const headers = { 'X-Telegram-Init-Data': signedInitData(1), 'content-type': 'application/json' }
  const request = (path, body) => worker.fetch(new Request(`https://worker.example${path}`, { method: 'POST', headers, body }), { ...env, ANALYTICS_DB: db })
  assert.equal((await request('/api/analytics/event', JSON.stringify({ type: 'search' }))).status, 204)
  assert.equal(db.users.size, 1)
  assert.equal([...db.users.values()][0].launches, 0)
  assert.equal((await request('/api/analytics/open')).status, 204)
  assert.equal([...db.users.values()][0].launches, 1)
})

test('event body rejects oversized and empty payloads before writing', async () => {
  const db = new FakeDb()
  const headers = { 'X-Telegram-Init-Data': signedInitData(1) }
  const request = (body) => worker.fetch(new Request('https://worker.example/api/analytics/event', { method: 'POST', headers, body }), { ...env, ANALYTICS_DB: db })
  assert.equal((await request('x'.repeat(1025))).status, 413)
  assert.equal((await request(undefined)).status, 400)
  assert.equal(db.events.length, 0)
})

test('group /stats command never sends private analytics to the group', async () => {
  const originalFetch = globalThis.fetch
  let sent = false
  globalThis.fetch = async () => { sent = true; return new Response('ok') }
  try {
    const response = await worker.fetch(new Request('https://worker.example/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({ message: { text: '/stats', from: { id: 1 }, chat: { id: -10, type: 'group' } } }),
    }), env)
    assert.equal(response.status, 200)
    assert.equal(sent, false)
  } finally { globalThis.fetch = originalFetch }
})

test('admin /stats in a private chat sends the report', async () => {
  const originalFetch = globalThis.fetch
  let sent
  globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); return new Response('ok') }
  try {
    const response = await worker.fetch(new Request('https://worker.example/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({ message: { text: '/stats', from: { id: 1 }, chat: { id: 1, type: 'private' } } }),
    }), { ...env, ANALYTICS_DB: new FakeDb() })
    assert.equal(response.status, 200)
    assert.equal(sent.chat_id, 1)
    assert.match(sent.text, /Статистика/)
  } finally { globalThis.fetch = originalFetch }
})

test('admin stats accepts only declared GET routes and periods', async () => {
  const headers = { 'X-Telegram-Init-Data': signedInitData(1) }
  for (const [path, method, status] of [
    ['/api/admin/stats/subjects?period=toString', 'GET', 400],
    ['/api/admin/anything/subjects', 'GET', 404],
    ['/api/admin/stats/materials', 'POST', 404],
  ]) {
    const response = await worker.fetch(new Request(`https://worker.example${path}`, { method, headers }), env)
    assert.equal(response.status, status)
  }
})

test('7-day and 30-day metrics use trailing hours', async () => {
  const db = new FakeDb()
  const current = Math.floor(Date.now() / 1000)
  db.users.set('older', { launches: 1 })
  db.events.push({ userHash: 'older', type: 'app_open', createdAt: current - 7 * 86_400 + 60 })
  const headers = { 'X-Telegram-Init-Data': signedInitData(1) }
  const response = await worker.fetch(new Request('https://worker.example/api/admin/stats/summary?period=7d', { headers }), { ...env, ANALYTICS_DB: db })
  const body = await response.json()
  assert.equal(body.users.days7, 1)
  assert.equal(body.users.days30, 1)
  assert.equal(body.launches, 1)
})

test('migration deduplicates only exact events in a minute', async () => {
  const migration = await readFile(new URL('../migrations/0001_analytics.sql', import.meta.url), 'utf8')
  assert.match(migration, /UNIQUE \(user_hash, event_type, subject_id, material_id, event_minute\)/)
})
