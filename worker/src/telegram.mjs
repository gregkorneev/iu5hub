const encoder = new TextEncoder()

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)))
}

function equalHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

/** Validates Telegram Mini App initData and returns only the trusted numeric ID. */
export async function validateInitData(initData, botToken, now = Date.now(), maxAgeSeconds = 86_400) {
  if (typeof initData !== 'string' || initData.length === 0 || initData.length > 8192 || !botToken) return null

  const params = new URLSearchParams(initData)
  const signature = params.get('hash')
  const authDate = params.get('auth_date')
  const user = params.get('user')
  if (!signature || !authDate || !user || !/^\d+$/.test(authDate)) return null

  const authSeconds = Number(authDate)
  if (!Number.isSafeInteger(authSeconds) || authSeconds > Math.floor(now / 1000) + 60 || authSeconds < Math.floor(now / 1000) - maxAgeSeconds) return null

  const checkString = [...params]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = await hmac(encoder.encode('WebAppData'), botToken)
  if (!equalHex(hex(await hmac(secret, checkString)), signature)) return null

  try {
    const parsed = JSON.parse(user)
    return typeof parsed.id === 'number' && Number.isSafeInteger(parsed.id) && parsed.id > 0 ? String(parsed.id) : null
  } catch {
    return null
  }
}

export async function hashTelegramUserId(telegramUserId, secret) {
  if (!/^\d+$/.test(telegramUserId) || !secret) throw new TypeError('A numeric Telegram user ID and HMAC secret are required')
  return hex(await hmac(encoder.encode(secret), telegramUserId))
}
