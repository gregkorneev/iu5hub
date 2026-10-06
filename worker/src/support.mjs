import { hashTelegramUserId } from './telegram.mjs'

const encoder = new TextEncoder()
const supported = ['text', 'photo', 'document', 'voice', 'audio', 'video', 'animation', 'sticker']
const unixNow = () => Math.floor(Date.now() / 1000)

function admins(env) {
  return [...new Set((env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id))))]
}

async function keyFor(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('Invalid support key')
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptChatId(chatId, secret) {
  const key = await keyFor(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(chatId)))
  const bytes = new Uint8Array(iv.length + encrypted.byteLength)
  bytes.set(iv); bytes.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...bytes))
}

export async function decryptChatId(ciphertext, secret) {
  const key = await keyFor(secret)
  const bytes = Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0))
  if (bytes.length < 29) throw new TypeError('Invalid support route')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  const value = new TextDecoder().decode(plain)
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid support route')
  return Number(value)
}

function apiUrl(env, method) { return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}` }

async function callBot(env, method, payload) {
  let result
  try {
    const response = await fetch(apiUrl(env, method), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    result = await response.json()
    return response.ok && result?.ok ? result.result : null
  } catch { return null }
}

function messageKind(message) {
  if (typeof message.text === 'string') return 'text'
  return supported.slice(1).find((kind) => message[kind]) ?? null
}

async function deliverToStudent(env, message, chatId, replyTo) {
  const payload = { chat_id: chatId, from_chat_id: message.chat.id, message_id: message.message_id }
  if (replyTo) payload.reply_parameters = { message_id: replyTo }
  let result = await callBot(env, 'copyMessage', payload)
  if (!result && replyTo) {
    delete payload.reply_parameters
    result = await callBot(env, 'copyMessage', payload)
  }
  return result
}

async function tell(env, chatId, text) { await callBot(env, 'sendMessage', { chat_id: chatId, text }) }

async function count(db, sql, ...values) { return (await db.prepare(sql).bind(...values).first())?.count ?? 0 }

async function saveAdminRoute(db, adminId, messageId, requestId, now) {
  await db.prepare('INSERT OR IGNORE INTO support_routes (admin_chat_id, admin_message_id, request_id, created_at) VALUES (?, ?, ?, ?)')
    .bind(adminId, messageId, requestId, now).run()
}

async function relayToAdmins(message, env, db, userHash, requestId, now) {
  let delivered = 0
  for (const adminId of admins(env)) {
    const numericAdminId = Number(adminId)
    if (await count(db, `SELECT COUNT(*) AS count FROM support_routes WHERE request_id = ? AND admin_chat_id = ?`, requestId, numericAdminId)) { delivered += 1; continue }
    const code = (userHash.slice(0, 4)).toUpperCase()
    const header = await callBot(env, 'sendMessage', { chat_id: numericAdminId, text: `💬 Обращение #${code}` })
    const copied = await callBot(env, 'copyMessage', { chat_id: Number(adminId), from_chat_id: message.chat.id, message_id: message.message_id })
    if (!copied?.message_id) continue
    await saveAdminRoute(db, numericAdminId, copied.message_id, requestId, now)
    if (header?.message_id) await saveAdminRoute(db, numericAdminId, header.message_id, requestId, now)
    delivered += 1
  }
  return delivered
}

async function studentMessage(message, env, db) {
  if (!Number.isSafeInteger(message.from?.id) || message.from.id <= 0 || message.chat.id !== message.from.id) return
  const userHash = await hashTelegramUserId(String(message.from.id), env.USER_ID_HMAC_SECRET)
  const existing = await db.prepare('SELECT id FROM support_requests WHERE user_hash = ? AND user_message_id = ?').bind(userHash, message.message_id).first()
  if (existing) {
    const delivered = await relayToAdmins(message, env, db, userHash, existing.id, unixNow())
    if (!delivered) await tell(env, message.chat.id, 'Не удалось связаться с поддержкой. Попробуйте позже.')
    return
  }
  const now = unixNow()
  const recent = await count(db, 'SELECT COUNT(*) AS count FROM support_requests WHERE user_hash = ? AND created_at > ?', userHash, now - 300)
  if (recent >= 10) { await tell(env, message.chat.id, 'Слишком много сообщений подряд. Попробуйте немного позже.'); return }
  const kind = messageKind(message)
  if (!kind) { await tell(env, message.chat.id, 'Этот тип сообщения пока не поддерживается. Пришлите текст, фото или файл.'); return }
  const encrypted = await encryptChatId(message.chat.id, env.SUPPORT_ENCRYPTION_KEY)
  await db.prepare('INSERT OR IGNORE INTO support_requests (user_hash, user_chat_ciphertext, user_message_id, created_at) VALUES (?, ?, ?, ?)')
    .bind(userHash, encrypted, message.message_id, now).run()
  const request = await db.prepare('SELECT id FROM support_requests WHERE user_hash = ? AND user_message_id = ?').bind(userHash, message.message_id).first()
  const delivered = await relayToAdmins(message, env, db, userHash, request.id, now)
  if (!delivered) { await tell(env, message.chat.id, 'Не удалось связаться с поддержкой. Попробуйте позже.'); return }
  if (!recent) await tell(env, message.chat.id, 'Сообщение передано. Ответ придёт в этот чат.')
}

async function adminReply(message, env, db) {
  const adminId = Number(message.from.id)
  const route = await db.prepare(`SELECT r.request_id AS requestId, s.user_chat_ciphertext AS chat,
      s.user_message_id AS userMessageId FROM support_routes r JOIN support_requests s ON s.id = r.request_id
      WHERE r.admin_chat_id = ? AND r.admin_message_id = ? AND s.created_at >= ?`)
    .bind(adminId, message.reply_to_message.message_id, unixNow() - 30 * 86_400).first()
  if (!route) { await tell(env, adminId, 'Не удалось доставить ответ пользователю.'); return }
  if (!messageKind(message)) { await tell(env, adminId, 'Этот тип сообщения пока не поддерживается.'); return }
  try {
    const chatId = await decryptChatId(route.chat, env.SUPPORT_ENCRYPTION_KEY)
    const sent = await deliverToStudent(env, message, chatId, route.userMessageId)
    if (sent) return
  } catch {}
  await tell(env, adminId, 'Не удалось доставить ответ пользователю.')
}

export async function handleSupportMessage(message, env, db) {
  if (!message || message.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id)) return
  const text = typeof message.text === 'string' ? message.text.trim() : ''
  if (/^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)) return
  if (Number.isSafeInteger(message.from?.id) && admins(env).includes(String(message.from.id)) && message.chat.id === message.from.id) {
    if (message.reply_to_message?.message_id) await adminReply(message, env, db)
    else if (messageKind(message)) await tell(env, message.chat.id, 'Чтобы ответить пользователю, нажмите «Ответить» на его обращении.')
    return
  }
  await studentMessage(message, env, db)
}
