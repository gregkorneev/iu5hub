import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { hashTelegramUserId, validateInitData } from '../src/telegram.mjs'

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
