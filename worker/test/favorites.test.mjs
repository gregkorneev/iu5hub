import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import worker from '../src/index.mjs'
import { hashTelegramUserId } from '../src/telegram.mjs'

const botToken = '123456:test'
function initData(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id }) })
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const key = createHmac('sha256', 'WebAppData').update(botToken).digest()
  params.set('hash', createHmac('sha256', key).update(check).digest('hex'))
  return params.toString()
}

class FakeDb {
  items = new Map()
  preferences = new Map()
  prepare(sql) {
    if (sql.includes('profile_preferences')) return { bind: (...args) => ({
      first: async () => {
        const row = this.preferences.get(args[0])
        return row ? { groupId: row.groupId, updatedAt: row.updatedAt } : null
      },
      run: async () => this.preferences.set(args[0], { userHash: args[0], groupId: args[1], updatedAt: args[2] }),
    }) }
    if (sql.startsWith('SELECT') || sql.startsWith('DELETE')) assert.match(sql, /WHERE user_hash = \?/, 'favorites query must be owner-scoped')
    if (sql.startsWith('DELETE')) assert.match(sql, /course_id = \? AND item_path = \?/, 'favorites delete must bind the complete key')
    return { bind: (...args) => ({
      run: async () => {
        if (sql.startsWith('INSERT')) {
          const [user, course, path, type, name, createdAt] = args
          const key = JSON.stringify([user, course, path])
          if (!this.items.has(key)) this.items.set(key, { user, courseId: course, path, type, name, createdAt })
        } else if (sql.startsWith('DELETE')) this.items.delete(JSON.stringify(args))
      },
      all: async () => ({ results: [...this.items.values()].filter(({ user }) => user === args[0]).map(({ user: _user, ...item }) => item) }),
    }) }
  }
}

const env = { TELEGRAM_BOT_TOKEN: botToken, USER_ID_HMAC_SECRET: 'distinct-user-secret', ANALYTICS_DB: new FakeDb() }
const item = { courseId: 'course-1', path: '/Математика/Лекция.pdf', type: 'file', name: 'Лекция.pdf' }
function request(method, user = 1, body, environment = env, origin) {
  return worker.fetch(new Request('https://worker.example/api/profile/favorites', {
    method,
    headers: { 'X-Telegram-Init-Data': initData(user), 'Content-Type': 'application/json', ...(origin && { Origin: origin }) },
    ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), environment)
}

function preferenceRequest(method, user = 1, body, environment = env) {
  return worker.fetch(new Request('https://worker.example/api/profile/schedule-group', {
    method,
    headers: { 'X-Telegram-Init-Data': initData(user), 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), environment)
}

test('favorites are scoped to signed user, idempotent, and independently deletable', async () => {
  const environment = { ...env, ANALYTICS_DB: new FakeDb() }
  assert.equal((await request('PUT', 1, item, environment)).status, 204)
  assert.equal((await request('PUT', 1, item, environment)).status, 204)
  assert.equal((await request('PUT', 2, item, environment)).status, 204)
  const mine = await (await request('GET', 1, undefined, environment)).json()
  assert.equal(mine.items.length, 1)
  assert.deepEqual({ ...mine.items[0], createdAt: 0 }, { ...item, createdAt: 0 })
  assert.equal((await request('DELETE', 1, { courseId: item.courseId, path: item.path }, environment)).status, 204)
  assert.deepEqual(await (await request('GET', 1, undefined, environment)).json(), { items: [] })
  assert.equal((await (await request('GET', 2, undefined, environment)).json()).items.length, 1)
})

test('profile requires signed Telegram identity and separate user secret', async () => {
  const unauthorized = await worker.fetch(new Request('https://worker.example/api/profile/favorites'), env)
  assert.equal(unauthorized.status, 401)
  const tampered = new URLSearchParams(initData(1))
  tampered.set('user', JSON.stringify({ id: 2 }))
  const forged = await worker.fetch(new Request('https://worker.example/api/profile/favorites', { headers: { 'X-Telegram-Init-Data': tampered.toString() } }), env)
  assert.equal(forged.status, 401)
  assert.equal((await request('GET', 1, undefined, { ...env, USER_ID_HMAC_SECRET: undefined })).status, 503)
  assert.equal((await request('GET', 1, undefined, { ...env, ANALYTICS_HMAC_SECRET: undefined })).status, 200)
})

test('persistent identity hash is stable, keyed and never exposes the Telegram ID', async () => {
  const hash = await hashTelegramUserId('123456789', env.USER_ID_HMAC_SECRET)
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(hash, await hashTelegramUserId('123456789', env.USER_ID_HMAC_SECRET))
  assert.notEqual(hash, await hashTelegramUserId('987654321', env.USER_ID_HMAC_SECRET))
  assert.notEqual(hash, await hashTelegramUserId('123456789', 'rotated-secret'))
  assert.equal(hash.includes('123456789'), false)
})

test('favorite input, payload size, methods and CORS are constrained', async () => {
  const environment = { ...env, ANALYTICS_DB: new FakeDb() }
  for (const bad of [
    { ...item, courseId: 'invalid' }, { ...item, path: 'https://evil.example/file' },
    { ...item, path: '/a/../b' }, { ...item, path: '' }, { ...item, name: ' ' },
    { ...item, type: 'url' }, { ...item, userHash: 'attacker' },
  ]) assert.equal((await request('PUT', 1, bad, environment)).status, 400)
  assert.equal((await request('PUT', 1, '{', environment)).status, 400)
  assert.equal((await request('PUT', 1, 'x'.repeat(4097), environment)).status, 413)
  assert.equal((await request('DELETE', 1, item, environment)).status, 400)
  assert.equal((await request('POST', 1, item, environment)).status, 404)
  const preflight = await worker.fetch(new Request('https://worker.example/api/profile/favorites', { method: 'OPTIONS', headers: { Origin: 'https://iu5hub.pages.dev' } }), environment)
  assert.match(preflight.headers.get('Access-Control-Allow-Methods'), /PUT, DELETE/)
  assert.equal(environment.ANALYTICS_DB.items.size, 0)
})

test('schedule group preference is HMAC-owned, cross-device readable, and isolated from favorites', async () => {
  const database = new FakeDb()
  const environment = { ...env, ANALYTICS_DB: database }
  assert.deepEqual(await (await preferenceRequest('GET', 1, undefined, environment)).json(), { groupId: null, updatedAt: null })
  const saved = await preferenceRequest('PUT', 1, { groupId: 'iu5-34b' }, environment)
  assert.equal(saved.status, 200)
  assert.deepEqual(await saved.json(), { groupId: 'iu5-34b', updatedAt: Math.floor(Date.now() / 1000) })
  assert.deepEqual(await (await preferenceRequest('GET', 1, undefined, environment)).json(), { groupId: 'iu5-34b', updatedAt: Math.floor(Date.now() / 1000) })
  assert.deepEqual(await (await preferenceRequest('GET', 2, undefined, environment)).json(), { groupId: null, updatedAt: null })
  assert.match([...database.preferences.keys()][0], /^[a-f0-9]{64}$/)
  assert.notEqual([...database.preferences.keys()][0], '1')
  assert.equal((await request('PUT', 1, item, environment)).status, 204)
  assert.equal((await request('GET', 1, undefined, environment)).status, 200)
  assert.equal(database.items.size, 1)
})

test('schedule group preference rejects invalid ids, extra body fields, and unauthenticated requests', async () => {
  const environment = { ...env, ANALYTICS_DB: new FakeDb() }
  for (const body of [
    { groupId: '../iu5-34b' }, { groupId: 'iu4-34b' }, { groupId: '' },
    { groupId: 'iu5-34b', userId: '2' }, {}, null,
  ]) assert.equal((await preferenceRequest('PUT', 1, body, environment)).status, 400)
  assert.equal((await preferenceRequest('PUT', 1, '{', environment)).status, 400)
  assert.equal((await preferenceRequest('POST', 1, { groupId: 'iu5-34b' }, environment)).status, 404)
  assert.equal((await worker.fetch(new Request('https://worker.example/api/profile/schedule-group'), environment)).status, 401)
  assert.equal(environment.ANALYTICS_DB.preferences.size, 0)
})
