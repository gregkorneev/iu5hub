import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import worker from '../src/index.mjs'

const token = '123456:token-for-test-only'
const now = Math.floor(Date.now() / 1000)

function signedInitData(userId, username) {
  const user = { id: userId, first_name: 'Private', last_name: 'Name', photo_url: 'private-photo' }
  if (username !== undefined) user.username = username
  const params = new URLSearchParams({ auth_date: String(now), user: JSON.stringify(user) })
  const check = [...params].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
  return params.toString()
}

const env = { ANALYTICS_HMAC_SECRET: 'server-only-secret', TELEGRAM_BOT_TOKEN: token, ADMIN_TELEGRAM_IDS: '1', TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' }

class FakeDb {
  users = new Map()
  events = []
  labels = new Map()
  statements = []

  prepare(sql) {
    return { bind: (...values) => ({ run: async () => this.execute(sql, values), first: async () => this.first(sql, values), all: async () => ({ results: this.all(sql, values) }) }) }
  }

  async batch(statements) { for (const statement of statements) await statement.run() }

  execute(sql, values) {
    this.statements.push({ sql, values })
    if (sql.includes('INSERT INTO analytics_user_labels')) { this.labels.set(values[0], { username: values[1], updatedAt: values[2] }); return }
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

  all(sql, values) {
    if (!sql.includes('FROM users u LEFT JOIN analytics_user_labels')) return []
    this.statements.push({ sql, values })
    let index = 1
    const username = sql.includes('instr(lower(COALESCE(l.username') ? values[index++] : null
    const minLaunchCount = sql.includes('u.launch_count >= ?') ? values[index++] : null
    const firstSeenOn = sql.includes("date(u.first_seen_at, 'unixepoch') = ?") ? values[index++] : null
    const lastSeenOn = sql.includes("date(u.last_seen_at, 'unixepoch') = ?") ? values[index++] : null
    const limit = values.at(-2), offset = values.at(-1), start = values[0]
    return [...this.users.entries()].map(([userHash, user]) => ({
      userHash, username: this.labels.get(userHash)?.username ?? null,
      firstSeenAt: user.firstSeen, lastSeenAt: user.lastSeen, launchCount: user.launches,
    })).filter((row) => row.lastSeenAt >= start &&
      (!username || (row.username ?? 'Без username').toLowerCase().includes(username.toLowerCase())) &&
      (minLaunchCount === null || row.launchCount >= minLaunchCount) &&
      (!firstSeenOn || new Date(row.firstSeenAt * 1000).toISOString().slice(0, 10) === firstSeenOn) &&
      (!lastSeenOn || new Date(row.lastSeenAt * 1000).toISOString().slice(0, 10) === lastSeenOn))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.userHash.localeCompare(b.userHash))
      .slice(offset, offset + limit)
      .map(({ userHash: _hash, ...item }) => item)
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

test('verified launch stores only the current username label, refreshes changes, clears missing names and keeps labels out of events', async () => {
  const db = new FakeDb()
  const open = async (username) => worker.fetch(new Request('https://worker.example/api/analytics/open', {
    method: 'POST', headers: { 'X-Telegram-Init-Data': signedInitData(77, username) },
  }), { ...env, ANALYTICS_DB: db })
  await open(' @@alice ')
  const hash = [...db.users.keys()][0]
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(db.labels.get(hash).username, 'alice')
  assert.equal(typeof db.labels.get(hash).updatedAt, 'number')
  assert.doesNotMatch(JSON.stringify({ events: db.events, statements: db.statements.map(({ sql, values }) => ({ sql, values })) }), /77|Private|Name|private-photo/)
  await open('new_name')
  assert.equal(db.labels.get(hash).username, 'new_name')
  await open(`${'x'.repeat(64)}\u0000`)
  assert.equal(db.labels.get(hash).username, null)
  await open('x'.repeat(65))
  assert.equal(db.labels.get(hash).username, null)
  await open(undefined)
  assert.equal(db.labels.get(hash).username, null)
  assert.equal(db.events.every((event) => !Object.hasOwn(event, 'username')), true)
  assert.equal(db.statements.some(({ sql }) => /username|first_name|last_name|photo_url/.test(sql) && sql.includes('INSERT INTO events')), false)
})

test('admin users endpoint requires valid initData and admin allowlist', async () => {
  assert.equal((await worker.fetch(new Request('https://worker.example/api/admin/stats/users'),
    { ...env, ANALYTICS_DB: new FakeDb() })).status, 401)
  const nonAdmin = await worker.fetch(new Request('https://worker.example/api/admin/stats/users', { headers: { 'X-Telegram-Init-Data': signedInitData(2) } }), { ...env, ANALYTICS_DB: new FakeDb() })
  assert.equal(nonAdmin.status, 403)
})

test('admin users list filters by period, sorts recent first, paginates, caps limit and omits hashes', async () => {
  const db = new FakeDb()
  const headers = { 'X-Telegram-Init-Data': signedInitData(1) }
  for (const [id, seen, username] of [['a', now - 20, 'alice'], ['b', now - 10, null], ['c', now - 40 * 86_400, 'older']]) {
    db.users.set(id, { firstSeen: seen - 100, lastSeen: seen, launches: 3 })
    if (username) db.labels.set(id, { username, updatedAt: seen })
  }
  const get = (query) => worker.fetch(new Request(`https://worker.example/api/admin/stats/users${query}`, { headers }), { ...env, ANALYTICS_DB: db })
  let response = await get('?period=30d&limit=1')
  let body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.items[0].username, null)
  assert.equal(body.items[0].launchCount, 3)
  assert.equal(body.nextOffset, 1)
  assert.equal(Object.hasOwn(body.items[0], 'user_hash'), false)
  response = await get('?period=30d&limit=1&offset=1')
  body = await response.json()
  assert.equal(body.items[0].username, 'alice')
  assert.equal(body.nextOffset, null)
  response = await get('?period=all&limit=999')
  body = await response.json()
  assert.equal(body.items.length, 3)
  assert.equal(body.items.length <= 100, true)
  assert.equal(db.statements.filter(({ sql }) => sql.includes('LEFT JOIN analytics_user_labels')).at(-1).values[1], 101)
  assert.equal((await get('?period=30d&limit=0')).status, 400)
  const alice = db.users.get('a')
  const filtered = await get(`?period=all&username=%40ali&minLaunchCount=3&firstSeenOn=${new Date(alice.firstSeen * 1000).toISOString().slice(0, 10)}&lastSeenOn=${new Date(alice.lastSeen * 1000).toISOString().slice(0, 10)}`)
  body = await filtered.json()
  assert.deepEqual(body.items.map((item) => item.username), ['alice'])
  response = await get('?period=all&username=без%20username')
  assert.deepEqual((await response.json()).items.map((item) => item.username), [null])
  response = await get('?period=all&username=alice&minLaunchCount=4')
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).items, [])
  for (const query of ['?firstSeenOn=2026-02-31', '?lastSeenOn=not-a-date', '?minLaunchCount=-1', `?username=${'x'.repeat(65)}`]) {
    assert.equal((await get(query)).status, 400)
  }
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

test('username labels migration is additive and stores no direct identity fields', async () => {
  const migration = await readFile(new URL('../migrations/0005_analytics_user_labels.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE analytics_user_labels/)
  assert.match(migration, /user_hash TEXT PRIMARY KEY/)
  assert.match(migration, /username TEXT/)
  assert.doesNotMatch(migration, /telegram_id|first_name|last_name|photo|phone|bio|event/i)
})
