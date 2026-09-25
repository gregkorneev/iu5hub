import { hashTelegramUserId, validateInitData } from './telegram.mjs'

const eventTypes = new Set(['search', 'subject_open', 'material_open', 'yandex_disk_open'])
const periods = { today: 1, '7d': 7, '30d': 30, all: null }
const idPattern = /^(?!.*:\/\/)[\p{L}\p{N}_./:-]{1,128}$/u

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

function unixNow() { return Math.floor(Date.now() / 1000) }
function startOfUtcDay(timestamp) { const date = new Date(timestamp * 1000); return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000) }
function periodStart(period, now) { return periods[period] === null ? 0 : period === 'today' ? startOfUtcDay(now) : now - periods[period] * 86_400 }

function adminIds(env) {
  return new Set((env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
}

async function identity(request, env) {
  const telegramUserId = await validateInitData(request.headers.get('X-Telegram-Init-Data'), env.TELEGRAM_BOT_TOKEN)
  if (!telegramUserId) return null
  return { telegramUserId, isAdmin: adminIds(env).has(telegramUserId) }
}

function validOptionalId(value) { return value === undefined || (typeof value === 'string' && idPattern.test(value)) }

async function readBody(request, limit) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = '', bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    bytes += value.byteLength
    if (bytes > limit) { await reader.cancel(); return null }
    text += decoder.decode(value, { stream: true })
  }
}

const courseIds = new Set(['course-1', 'course-2', 'course-3'])
function validFavoriteKey(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    courseIds.has(value.courseId) && typeof value.path === 'string' &&
    value.path.length > 0 && value.path.length <= 2048 && value.path.trim() === value.path &&
    !value.path.startsWith('//') && !value.path.includes('://') &&
    (!/^[a-z][a-z\d+.-]*:/i.test(value.path) || value.path.startsWith('disk:/')) &&
    !/[\\\u0000-\u001f\u007f]/.test(value.path) &&
    !value.path.split('/').some((segment) => segment === '.' || segment === '..')
}
function validFavorite(value, deleting) {
  if (!validFavoriteKey(value)) return false
  const keys = Object.keys(value)
  if (deleting) return keys.length === 2 && keys.every((key) => ['courseId', 'path'].includes(key))
  return keys.length === 4 && keys.every((key) => ['courseId', 'path', 'type', 'name'].includes(key)) &&
    ['dir', 'file'].includes(value.type) && typeof value.name === 'string' &&
    value.name.trim().length > 0 && value.name.length <= 255 && !/[\u0000-\u001f\u007f]/.test(value.name)
}

async function favorites(request, env, telegramUserId) {
  const userHash = await hashTelegramUserId(telegramUserId, env.USER_ID_HMAC_SECRET)
  const db = env.ANALYTICS_DB
  if (request.method === 'GET') {
    const rows = await queryAll(db, 'SELECT course_id AS courseId, item_path AS path, item_type AS type, item_name AS name, created_at AS createdAt FROM favorites WHERE user_hash = ? ORDER BY created_at DESC', userHash)
    return json({ items: rows })
  }
  if (request.method !== 'PUT' && request.method !== 'DELETE') return new Response('Not found', { status: 404 })
  const raw = await readBody(request, 4096)
  if (raw === null) return json({ error: 'Payload too large' }, 413)
  let item
  try { item = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!validFavorite(item, request.method === 'DELETE')) return json({ error: 'Invalid favorite' }, 400)
  if (request.method === 'PUT') {
    await db.prepare('INSERT OR IGNORE INTO favorites (user_hash, course_id, item_path, item_type, item_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userHash, item.courseId, item.path, item.type, item.name, unixNow()).run()
  } else {
    await db.prepare('DELETE FROM favorites WHERE user_hash = ? AND course_id = ? AND item_path = ?')
      .bind(userHash, item.courseId, item.path).run()
  }
  return new Response(null, { status: 204 })
}

async function trackOpen(db, userHash, now) {
  const minute = Math.floor(now / 60)
  await db.batch([
    db.prepare(`INSERT INTO users (user_hash, first_seen_at, last_seen_at, launch_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at,
      launch_count = launch_count + CASE WHEN NOT EXISTS (
        SELECT 1 FROM events WHERE user_hash = ? AND event_type = 'app_open' AND event_minute = ?
      ) THEN 1 ELSE 0 END`).bind(userHash, now, now, userHash, minute),
    db.prepare('INSERT OR IGNORE INTO events (user_hash, event_type, event_minute, created_at) VALUES (?, \'app_open\', ?, ?)').bind(userHash, minute, now),
  ])
}

async function trackEvent(db, userHash, event, now) {
  await db.batch([
    db.prepare(`INSERT INTO users (user_hash, first_seen_at, last_seen_at, launch_count) VALUES (?, ?, ?, 0)
      ON CONFLICT(user_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at`).bind(userHash, now, now),
    db.prepare(`INSERT OR IGNORE INTO events
      (user_hash, event_type, subject_id, material_id, event_minute, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
      userHash, event.type, event.subjectId ?? '', event.materialId ?? '', Math.floor(now / 60), now,
    ),
  ])
}

async function queryOne(db, sql, ...bindings) { return db.prepare(sql).bind(...bindings).first() }
async function queryAll(db, sql, ...bindings) { return (await db.prepare(sql).bind(...bindings).all()).results }
async function activity(db, now, start) {
  const rows = await queryAll(db, `SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS date, COUNT(DISTINCT user_hash) AS users, SUM(event_type = 'app_open') AS launches FROM events WHERE created_at >= ? GROUP BY date ORDER BY date`, Math.max(start, startOfUtcDay(now) - 29 * 86_400))
  const byDate = new Map(rows.map((row) => [row.date, row]))
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date((startOfUtcDay(now) - (29 - index) * 86_400) * 1000).toISOString().slice(0, 10)
    return byDate.get(date) ?? { date, users: 0, launches: 0 }
  })
}

async function summary(db, now, period) {
  const start = periodStart(period, now)
  const today = startOfUtcDay(now)
  const [total, day, week, month, launches, searches, materialOpens, yandexDiskOpens] = await Promise.all([
    queryOne(db, 'SELECT COUNT(*) AS count FROM users'),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', today),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', now - 7 * 86_400),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', now - 30 * 86_400),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'app_open' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'search' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'material_open' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'yandex_disk_open' AND created_at >= ?", start),
  ])
  return { period, users: { total: total.count, today: day.count, days7: week.count, days30: month.count }, launches: launches.count, activity: { searches: searches.count, materialOpens: materialOpens.count, yandexDiskOpens: yandexDiskOpens.count } }
}

async function telegramStats(env, chatId) {
  const now = unixNow()
  const [today, week] = await Promise.all([summary(env.ANALYTICS_DB, now, 'today'), summary(env.ANALYTICS_DB, now, '7d')])
  const text = `📊 Статистика «Студент ИУ5»\n\n👥 Пользователи\nВсего: ${today.users.total}\nСегодня: ${today.users.today}\n7 дней: ${today.users.days7}\n30 дней: ${today.users.days30}\n\n🚀 Запуски\nСегодня: ${today.launches}\n7 дней: ${week.launches}\n\n📚 Открытий материалов сегодня: ${today.activity.materialOpens}\n🔎 Поисков сегодня: ${today.activity.searches}\n↗️ Переходов на Яндекс.Диск сегодня: ${today.activity.yandexDiskOpens}`
  const body = { chat_id: chatId, text }
  if (env.ADMIN_DASHBOARD_URL) body.reply_markup = { inline_keyboard: [[{ text: 'Открыть полную статистику', web_app: { url: env.ADMIN_DASHBOARD_URL } }]] }
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function webhook(request, env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response(null, { status: 401 })
  let update
  try { update = await request.json() } catch { return new Response(null, { status: 400 }) }
  const message = update?.message
  if (message?.text?.trim() === '/stats' && message.chat?.type === 'private' && message.chat.id === message.from?.id && Number.isSafeInteger(message.from.id) && adminIds(env).has(String(message.from.id))) await telegramStats(env, message.chat.id)
  return new Response('ok')
}

async function handle(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/telegram/webhook' && request.method === 'POST') return webhook(request, env)
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    const user = await identity(request, env)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (url.pathname === '/api/admin/me' && request.method === 'GET') return json({ isAdmin: user.isAdmin })
    if (url.pathname === '/api/profile/favorites') return favorites(request, env, user.telegramUserId)
    if (url.pathname === '/api/analytics/open' && request.method === 'POST') { await trackOpen(env.ANALYTICS_DB, await hashTelegramUserId(user.telegramUserId, env.ANALYTICS_HMAC_SECRET), unixNow()); return new Response(null, { status: 204 }) }
    if (url.pathname === '/api/analytics/event' && request.method === 'POST') {
      const raw = await readBody(request, 1024)
      if (raw === null) return json({ error: 'Payload too large' }, 413)
      let event
      try { event = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
      if (!event || !eventTypes.has(event.type) || !validOptionalId(event.subjectId) || !validOptionalId(event.materialId) || Object.keys(event).some((key) => !['type', 'subjectId', 'materialId'].includes(key))) return json({ error: 'Invalid event' }, 400)
      await trackEvent(env.ANALYTICS_DB, await hashTelegramUserId(user.telegramUserId, env.ANALYTICS_HMAC_SECRET), event, unixNow())
      return new Response(null, { status: 204 })
    }
    if (!url.pathname.startsWith('/api/admin/')) return new Response('Not found', { status: 404 })
    if (!user.isAdmin) return json({ error: 'Forbidden' }, 403)
    const period = url.searchParams.get('period') ?? '30d'
    if (!Object.hasOwn(periods, period)) return json({ error: 'Invalid period' }, 400)
    const now = unixNow(), start = periodStart(period, now)
    if (url.pathname === '/api/admin/stats/summary' && request.method === 'GET') return json(await summary(env.ANALYTICS_DB, now, period))
    if (url.pathname === '/api/admin/stats/activity' && request.method === 'GET') return json({ period, days: await activity(env.ANALYTICS_DB, now, start) })
    const field = request.method === 'GET' && url.pathname === '/api/admin/stats/subjects' ? 'subject_id' : request.method === 'GET' && url.pathname === '/api/admin/stats/materials' ? 'material_id' : null
    if (field) return json({ period, items: await queryAll(env.ANALYTICS_DB, `SELECT ${field} AS id, COUNT(*) AS count FROM events WHERE ${field} != '' AND created_at >= ? GROUP BY ${field} ORDER BY count DESC, id LIMIT 10`, start) })
    return new Response('Not found', { status: 404 })
}

function withCors(request, env, response) {
  const origin = request.headers.get('Origin')
  if (origin && origin === (env.ANALYTICS_ALLOWED_ORIGIN ?? 'https://iu5hub.pages.dev')) {
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    headers.set('Vary', 'Origin')
    return new Response(response.body, { status: response.status, headers })
  }
  return response
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(request, env, new Response(null, { status: 204 }))
    try {
      return withCors(request, env, await handle(request, env))
    } catch {
      return withCors(request, env, json({ error: 'Service unavailable' }, 503))
    }
  },
  async scheduled(_controller, env) {
    await env.ANALYTICS_DB.prepare('DELETE FROM events WHERE created_at < ?').bind(unixNow() - 90 * 86_400).run()
  },
}
