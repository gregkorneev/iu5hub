import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { hashTelegramUserId, validateInitData, validateInitDataUser } from '../src/telegram.mjs'

const token = '123456:token-for-test-only'
const now = Date.UTC(2026, 8, 21, 12, 0, 0)

function initData(values = {}) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 12345 }), ...values })
  const check = [...params].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
  return params.toString()
}

test('validates Telegram initData and returns only the trusted user ID', async () => {
  assert.equal(await validateInitData(initData(), token, now), '12345')
})

test('returns username only from signed initData and accepts absent username', async () => {
  const withUsername = new URLSearchParams(initData())
  const fields = new URLSearchParams(withUsername)
  fields.set('user', JSON.stringify({ id: 12345, username: 'trusted_name', first_name: 'Private', last_name: 'Person' }))
  const check = [...fields].filter(([key]) => key !== 'hash').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  fields.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
  assert.deepEqual(await validateInitDataUser(fields.toString(), token, now), { id: '12345', username: 'trusted_name' })
  assert.deepEqual(await validateInitDataUser(initData(), token, now), { id: '12345', username: null })
})

test('rejects malformed JSON, missing or unsafe numeric Telegram IDs', async () => {
  for (const user of ['{invalid', JSON.stringify({ username: 'alice' }), JSON.stringify({ id: '12345' }), JSON.stringify({ id: 0 }), JSON.stringify({ id: 1.5 }), JSON.stringify({ id: Number.MAX_SAFE_INTEGER + 1 })]) {
    const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user })
    const check = [...params].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(token).digest()
    params.set('hash', createHmac('sha256', secret).update(check).digest('hex'))
    assert.equal(await validateInitDataUser(params.toString(), token, now), null)
  }
  assert.equal(await validateInitDataUser(new URLSearchParams({ auth_date: String(Math.floor(now / 1000)) }).toString(), token, now), null)
})

test('rejects tampered, expired, and malformed Telegram initData', async () => {
  assert.equal(await validateInitData(`${initData()}x`, token, now), null)
  assert.equal(await validateInitData(initData({ auth_date: '1' }), token, now), null)
  assert.equal(await validateInitData(initData({ user: '{invalid' }), token, now), null)
})

test('uses a keyed, deterministic anonymous user hash', async () => {
  const first = await hashTelegramUserId('12345', 'server-only-secret')
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(first, await hashTelegramUserId('12345', 'server-only-secret'))
  assert.notEqual(first, await hashTelegramUserId('12345', 'other-server-secret'))
})
