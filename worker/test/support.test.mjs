import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import worker from '../src/index.mjs'
import { decryptChatId, encryptChatId, handleSupportMessage } from '../src/support.mjs'

const key = 'test-only-support-encryption-key-which-is-long-enough'
const env = { TELEGRAM_BOT_TOKEN: '123456:test-token', USER_ID_HMAC_SECRET: 'user-hmac-secret', SUPPORT_ENCRYPTION_KEY: key, ADMIN_TELEGRAM_IDS: '7001,7002' }

class Db {
  requests = []
  routes = []
  events = []
  bindings = []
  prepare(sql) {
    return { bind: (...values) => ({
      run: async () => this.run(sql, values),
      first: async () => this.first(sql, values),
      all: async () => ({ results: [] }),
    }) }
  }
  async batch(statements) { for (const item of statements) await item.run() }
  async run(sql, v) {
    this.bindings.push({ sql, values: v })
    if (sql.includes('INSERT OR IGNORE INTO support_requests')) {
      if (!this.requests.some((r) => r.userHash === v[0] && r.userMessageId === v[2])) this.requests.push({ id: this.requests.length + 1, userHash: v[0], cipher: v[1], userMessageId: v[2], createdAt: v[3] })
    } else if (sql.includes('INSERT OR IGNORE INTO support_routes')) {
      if (!this.routes.some((r) => r.adminId === v[0] && r.adminMessageId === v[1])) this.routes.push({ adminId: v[0], adminMessageId: v[1], requestId: v[2], createdAt: v[3] })
    } else if (sql.includes('DELETE FROM support_routes')) this.routes = this.routes.filter((r) => r.createdAt >= v[0])
    else if (sql.includes('DELETE FROM support_requests')) this.requests = this.requests.filter((r) => r.createdAt >= v[0])
    else if (sql.includes('DELETE FROM events')) this.events = this.events.filter((e) => e.createdAt >= v[0])
    return { meta: { changes: 1 } }
  }
  async first(sql, v) {
    this.bindings.push({ sql, values: v })
    if (sql.includes('SELECT id FROM support_requests WHERE')) return this.requests.find((r) => r.userHash === v[0] && r.userMessageId === v[1]) ? { id: this.requests.find((r) => r.userHash === v[0] && r.userMessageId === v[1]).id } : null
    if (sql.includes('SELECT COUNT(*) AS count FROM support_requests')) return { count: this.requests.filter((r) => r.userHash === v[0] && r.createdAt > v[1]).length }
    if (sql.includes('SELECT COUNT(*) AS count FROM support_routes')) return { count: this.routes.filter((r) => r.requestId === v[0] && r.adminId === v[1]).length }
    if (sql.includes('FROM support_routes r JOIN support_requests')) {
      const route = this.routes.find((r) => r.adminId === v[0] && r.adminMessageId === v[1])
      const req = this.requests.find((r) => r.id === route?.requestId && r.createdAt >= v[2])
      return req ? { requestId: req.id, chat: req.cipher, userMessageId: req.userMessageId } : null
    }
    return null
  }
}

class StatsDb extends Db {
  async first() { return { count: 0 } }
}

function msg({ id = 1, sender = 5001, chat = sender, type = 'private', username = 'operator', ...content } = {}) {
  return { message_id: id, from: { id: sender, first_name: 'Private', username }, chat: { id: chat, type }, ...content }
}

function botMock(handler) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    const method = url.split('/').at(-1)
    const payload = JSON.parse(options.body)
    calls.push({ method, payload })
    const result = await handler(method, payload, calls.length)
    return new Response(JSON.stringify(result), { status: 200 })
  }
  return { calls, restore: () => { globalThis.fetch = original } }
}

test('AES-GCM routing value round-trips and rejects a wrong key', async () => {
  const cipher = await encryptChatId(5001, key)
  assert.equal(await decryptChatId(cipher, key), 5001)
  await assert.rejects(decryptChatId(cipher, `${key}-wrong`))
  assert.doesNotMatch(cipher, /5001/)
})

test('student text is copied to all admins; D1 contains no message or raw student ID', async () => {
  const db = new Db()
  const mock = botMock((method, payload) => ({ ok: true, result: { message_id: method === 'copyMessage' ? 9001 + payload.chat_id : 9100 + payload.chat_id } }))
  try {
    await handleSupportMessage(msg({ id: 44, text: 'private student message', sender: 5001 }), env, db)
    assert.deepEqual(mock.calls.filter((c) => c.method === 'copyMessage').map((c) => c.payload.chat_id), [7001, 7002])
    assert.deepEqual(mock.calls.filter((c) => c.method === 'sendMessage' && c.payload.text.startsWith('💬')).map((c) => c.payload.chat_id), [7001, 7002])
    assert.equal(mock.calls.filter((c) => c.method === 'sendMessage').some((c) => c.payload.text.includes('передано')), true)
    assert.equal(db.requests.length, 1)
    assert.doesNotMatch(JSON.stringify(db.requests), /5001|private student message/)
    assert.equal(db.routes.length, 4)
    assert.equal(mock.calls.some((c) => c.method === 'forwardMessage'), false)
  } finally { mock.restore() }
})

test('admin header appends only a trimmed valid username; username stays transient and out of student-facing data', async () => {
  const db = new Db()
  const mock = botMock((method, payload, call) => ({ ok: true, result: { message_id: 12000 + call } }))
  const cases = [
    { username: '  alice_123  ', expected: ' · @alice_123' },
    { username: undefined, expected: '' },
    { username: '', expected: '' },
    { username: 12345, expected: '' },
    { username: 'bad\u0000name', expected: '' },
    { username: '<b>alice</b>', expected: '' },
    { username: '*alice*', expected: '' },
    { username: '[alice](https://example.test)', expected: '' },
  ]
  try {
    for (const [index, item] of cases.entries()) {
      const message = msg({ id: 100 + index, sender: 5200 + index, username: item.username, text: 'hello' })
      if (item.username === undefined) delete message.from.username
      await handleSupportMessage(message, env, db)
    }
    const headers = mock.calls.filter((call) => call.method === 'sendMessage' && call.payload.text.startsWith('💬'))
    assert.equal(headers.length, cases.length * 2)
    for (const [index, item] of cases.entries()) {
      const expected = /^💬 Обращение #[A-F0-9]{4}/
      const pair = headers.slice(index * 2, index * 2 + 2)
      assert.ok(pair.every((call) => expected.test(call.payload.text)))
      assert.ok(pair.every((call) => call.payload.text.endsWith(item.expected) && !Object.hasOwn(call.payload, 'parse_mode')))
      if (!item.expected) assert.ok(pair.every((call) => /^💬 Обращение #[A-F0-9]{4}$/.test(call.payload.text)))
    }
    await handleSupportMessage(msg({ id: 200, sender: 7001, username: 'admin_markdown', text: 'answer', reply_to_message: { message_id: 12001 } }), env, db)
    const userCopy = mock.calls.find((call) => call.method === 'copyMessage' && call.payload.chat_id === 5200)
    assert.ok(userCopy)
    assert.doesNotMatch(JSON.stringify(userCopy.payload), /alice_123|admin_markdown/)
    assert.doesNotMatch(JSON.stringify(db.bindings), /alice_123|bad|admin_markdown/)
    assert.doesNotMatch(JSON.stringify(db.requests), /alice_123|operator|first_name|username/)
    assert.doesNotMatch(JSON.stringify(db.routes), /alice_123|admin_markdown|username/)
    assert.deepEqual(db.events, [])
    assert.equal(db.requests.length, cases.length)
  } finally { mock.restore() }
})

test('photo is copied and admin reply reaches student as a bot copy without admin profile identity', async () => {
  const db = new Db()
  const mock = botMock((method, payload) => ({ ok: true, result: { message_id: method === 'copyMessage' ? 8000 + payload.chat_id : 8100 + payload.chat_id } }))
  try {
    await handleSupportMessage(msg({ id: 48, sender: 5002, photo: [{ file_id: 'photo-id' }] }), env, db)
    const adminMessageId = 15001
    await handleSupportMessage(msg({ id: 99, sender: 7001, text: 'Fixed', reply_to_message: { message_id: adminMessageId } }), env, db)
    const userSend = mock.calls.find((c) => c.method === 'copyMessage' && c.payload.chat_id === 5002)
    assert.ok(userSend, JSON.stringify(mock.calls))
    assert.equal(userSend.payload.from_chat_id, 7001)
    assert.deepEqual(userSend.payload.reply_parameters, { message_id: 48 })
    assert.doesNotMatch(JSON.stringify(mock.calls.filter((c) => c.payload.chat_id === 5002)), /operator|Private/)
  } finally { mock.restore() }
})

test('document and voice student messages are copied to every support admin', async () => {
  const db = new Db()
  const mock = botMock((method, payload, call) => ({ ok: true, result: { message_id: 10000 + call } }))
  try {
    await handleSupportMessage(msg({ id: 51, sender: 5012, document: { file_id: 'doc-file' } }), env, db)
    await handleSupportMessage(msg({ id: 52, sender: 5012, voice: { file_id: 'voice-file' } }), env, db)
    const copies = mock.calls.filter((c) => c.method === 'copyMessage')
    assert.equal(copies.length, 4)
    assert.deepEqual(copies.map((c) => c.payload.message_id), [51, 51, 52, 52])
    assert.deepEqual(copies.map((c) => c.payload.chat_id), [7001, 7002, 7001, 7002])
  } finally { mock.restore() }
})

test('duplicate delivery is idempotent and only the first recent message gets an acknowledgement', async () => {
  const db = new Db()
  const mock = botMock((method, payload) => ({ ok: true, result: { message_id: method === 'copyMessage' ? 700 + payload.chat_id : 900 + payload.chat_id } }))
  try {
    const message = msg({ id: 50, sender: 5003, text: 'question' })
    await handleSupportMessage(message, env, db)
    const before = mock.calls.filter((c) => c.method === 'copyMessage').length
    await handleSupportMessage(message, env, db)
    assert.equal(mock.calls.filter((c) => c.method === 'copyMessage').length, before)
    assert.equal(mock.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === 5003).length, 1)
  } finally { mock.restore() }
})

test('unsupported content and group messages never enter support routing', async () => {
  const db = new Db()
  const mock = botMock(() => ({ ok: true, result: { message_id: 1 } }))
  try {
    await handleSupportMessage(msg({ id: 5, sender: 5004, contact: { phone_number: 'secret' } }), env, db)
    await handleSupportMessage(msg({ id: 6, sender: 5004, chat: -10, type: 'group', text: 'group' }), env, db)
    assert.equal(db.requests.length, 0)
    assert.match(mock.calls[0].payload.text, /не поддерживается/i)
    assert.equal(mock.calls.some((c) => c.method === 'copyMessage'), false)
  } finally { mock.restore() }
})

test('limit is ten messages per five minutes', async () => {
  const db = new Db()
  const mock = botMock(() => ({ ok: true, result: { message_id: 123 } }))
  try {
    const now = Math.floor(Date.now() / 1000)
    db.requests = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, userHash: 'hash', cipher: 'cipher', userMessageId: i, createdAt: now }))
    const { hashTelegramUserId } = await import('../src/telegram.mjs')
    db.requests.forEach((r) => { r.userHash = undefined })
    const hash = await hashTelegramUserId('5005', env.USER_ID_HMAC_SECRET)
    db.requests.forEach((r) => { r.userHash = hash })
    await handleSupportMessage(msg({ id: 75, sender: 5005, text: 'eleventh' }), env, db)
    assert.equal(mock.calls.some((c) => c.method === 'copyMessage'), false)
    assert.match(mock.calls[0].payload.text, /слишком много/i)
  } finally { mock.restore() }
})

test('admin message without reply and unknown or expired routes cannot reach a student', async () => {
  const db = new Db()
  const mock = botMock(() => ({ ok: true, result: { message_id: 321 } }))
  try {
    await handleSupportMessage(msg({ id: 60, sender: 7001, text: 'no reply' }), env, db)
    await handleSupportMessage(msg({ id: 61, sender: 7001, text: 'unknown', reply_to_message: { message_id: 123456 } }), env, db)
    db.requests.push({ id: 1, userHash: 'h', cipher: await encryptChatId(5006, key), userMessageId: 4, createdAt: 1 })
    db.routes.push({ adminId: 7001, adminMessageId: 222, requestId: 1, createdAt: 1 })
    await handleSupportMessage(msg({ id: 62, sender: 7001, text: 'expired', reply_to_message: { message_id: 222 } }), env, db)
    assert.equal(mock.calls.some((c) => c.payload.chat_id === 5006), false)
    assert.equal(mock.calls.filter((c) => /Ответить/.test(c.payload.text ?? '')).length, 1)
  } finally { mock.restore() }
})

test('non-admin reply, command handling and webhook secret validation remain safe', async () => {
  const db = new Db()
  const mock = botMock(() => ({ ok: true, result: { message_id: 77 } }))
  try {
    await handleSupportMessage(msg({ id: 2, sender: 6001, text: 'intruder', reply_to_message: { message_id: 222 } }), env, db)
    assert.equal(mock.calls.some((c) => c.payload.chat_id === 5001), false)
  } finally { mock.restore() }
  const request = (body, secret) => worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: secret === undefined ? {} : { 'X-Telegram-Bot-Api-Secret-Token': secret, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { ...env, TELEGRAM_WEBHOOK_SECRET: 'secret', ANALYTICS_DB: new StatsDb() })
  const statsMock = botMock(() => ({ ok: true, result: { message_id: 77 } }))
  try {
    assert.equal((await request({ message: msg({ sender: 7001, text: '/stats' }) }, 'secret')).status, 200)
    assert.equal(statsMock.calls.some((c) => c.payload.text?.includes('Статистика')), true)
    const before = statsMock.calls.length
    assert.equal((await request({ message: msg({ sender: 6001, text: '/stats' }) }, 'secret')).status, 200)
    assert.equal(statsMock.calls.length, before)
    assert.equal((await request({ message: msg({ sender: 5001, text: '/start' }) }, 'wrong')).status, 401)
    assert.equal((await request({ message: msg({ sender: 5001, text: '/start' }) })).status, 401)
    assert.equal((await request({ message: msg({ sender: 5001, text: '/start' }) }, 'secret')).status, 200)
    assert.equal(statsMock.calls.length, before)
    const malformed = await worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'secret' }, body: '{' }), { ...env, TELEGRAM_WEBHOOK_SECRET: 'secret', ANALYTICS_DB: new StatsDb() })
    assert.equal(malformed.status, 400)
  } finally { statsMock.restore() }
})

test('no-admin-copy and failed Bot API responses return a safe failure to the student', async () => {
  const db = new Db()
  const noAdmins = botMock(() => ({ ok: false, description: 'private api failure' }))
  try {
    await handleSupportMessage(msg({ id: 81, sender: 5007, text: 'hello' }), { ...env, ADMIN_TELEGRAM_IDS: '' }, db)
    assert.equal(noAdmins.calls.some((c) => c.method === 'copyMessage'), false)
    assert.match(noAdmins.calls.at(-1).payload.text, /не удалось связаться/i)
  } finally { noAdmins.restore() }
  const failure = botMock(() => ({ ok: false, description: 'failed' }))
  try {
    await handleSupportMessage(msg({ id: 82, sender: 5008, text: 'hello' }), env, db)
    assert.match(failure.calls.at(-1).payload.text, /не удалось связаться/i)
  } finally { failure.restore() }
})

test('admin reply retries without an invalid reply reference and API success uses result payload', async () => {
  const db = new Db()
  const mock = botMock((method, payload, call) => {
    if (method === 'copyMessage' && payload.chat_id === 5009 && payload.reply_parameters) return { ok: false }
    if (method === 'copyMessage') return { ok: true, result: { message_id: 9001 } }
    return { ok: true, result: { message_id: 9100 + call } }
  })
  try {
    await handleSupportMessage(msg({ id: 70, sender: 5009, text: 'help' }), env, db)
    await handleSupportMessage(msg({ id: 71, sender: 7001, text: 'answer', reply_to_message: { message_id: 9001 } }), env, db)
    const calls = mock.calls.filter((c) => c.method === 'copyMessage' && c.payload.chat_id === 5009)
    assert.equal(calls.length, 2, JSON.stringify(mock.calls))
    assert.ok(calls[0].payload.reply_parameters)
    assert.equal(calls[1].payload.reply_parameters, undefined)
  } finally { mock.restore() }
})

test('failed user reply sends a generic delivery failure notice to the replying admin', async () => {
  const db = new Db()
  const mock = botMock((method, payload) => {
    if (method === 'copyMessage' && payload.chat_id === 5010) return { ok: false, description: 'blocked' }
    if (method === 'copyMessage') return { ok: true, result: { message_id: 9010 } }
    return { ok: true, result: { message_id: 9020 } }
  })
  try {
    await handleSupportMessage(msg({ id: 90, sender: 5010, text: 'question' }), env, db)
    await handleSupportMessage(msg({ id: 91, sender: 7001, text: 'answer', reply_to_message: { message_id: 9010 } }), env, db)
    const notice = mock.calls.find((c) => c.method === 'sendMessage' && c.payload.chat_id === 7001 && /не удалось доставить ответ/i.test(c.payload.text))
    assert.ok(notice)
    assert.doesNotMatch(notice.payload.text, /5010|blocked/)
  } finally { mock.restore() }
})

test('scheduled cleanup removes old routes, requests and analytics events while retaining recent rows', async () => {
  const db = new Db()
  const now = Math.floor(Date.now() / 1000)
  db.requests = [{ id: 1, createdAt: now - 31 * 86_400 }, { id: 2, createdAt: now }]
  db.routes = [{ adminId: 1, adminMessageId: 1, requestId: 1, createdAt: now - 31 * 86_400 }, { adminId: 1, adminMessageId: 2, requestId: 2, createdAt: now }]
  db.events = [{ createdAt: now - 91 * 86_400 }, { createdAt: now }]
  await worker.scheduled({}, { ANALYTICS_DB: db })
  assert.deepEqual(db.requests.map((r) => r.id), [2])
  assert.deepEqual(db.routes.map((r) => r.adminMessageId), [2])
  assert.deepEqual(db.events, [{ createdAt: now }])
})

test('support schema has no message-body or raw-user-id columns', async () => {
  const sql = await readFile(new URL('../migrations/0004_support.sql', import.meta.url), 'utf8')
  assert.match(sql, /UNIQUE \(user_hash, user_message_id\)/)
  assert.match(sql, /user_chat_ciphertext/)
  assert.doesNotMatch(sql, /message_text|caption|username|first_name|telegram_user_id|chat_id TEXT/i)
})
