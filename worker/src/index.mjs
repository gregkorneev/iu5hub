import { hashTelegramUserId, validateInitData } from './telegram.mjs'

const eventTypes = new Set(['search', 'subject_open', 'material_open', 'yandex_disk_open'])
const periods = { today: 1, '7d': 7, '30d': 30, all: null }
const idPattern = /^(?!.*:\/\/)[\p{L}\p{N}_./:-]{1,128}$/u

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

function unixNow() { return Math.floor(Date.now() / 1000) }
function startOfUtcDay(timestamp) { const date = new Date(timestamp * 1000); return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000) }
function periodStart(period, now) { return periods[period] === null ? 0 : startOfUtcDay(now) - (periods[period] - 1) * 86_400 }

function adminIds(env) {
  return new Set((env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
}

async function identity(request, env) {
  const telegramUserId = await validateInitData(request.headers.get('X-Telegram-Init-Data'), env.TELEGRAM_BOT_TOKEN)
  if (!telegramUserId) return null
  return { isAdmin: adminIds(env).has(telegramUserId), userHash: await hashTelegramUserId(telegramUserId, env.ANALYTICS_HMAC_SECRET) }
}

function validOptionalId(value) { return value === undefined || (typeof value === 'string' && idPattern.test(value)) }

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
  await db.prepare(`INSERT OR IGNORE INTO events
    (user_hash, event_type, subject_id, material_id, event_minute, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
    userHash, event.type, event.subjectId ?? '', event.materialId ?? '', Math.floor(now / 60), now,
  ).run()
}

async function queryOne(db, sql, ...bindings) { return db.prepare(sql).bind(...bindings).first() }
async function queryAll(db, sql, ...bindings) { return (await db.prepare(sql).bind(...bindings).all()).results }

async function summary(db, now, period) {
  const start = periodStart(period, now)
  const today = startOfUtcDay(now)
  const [total, day, week, month, launches, searches, materialOpens, yandexDiskOpens] = await Promise.all([
    queryOne(db, 'SELECT COUNT(*) AS count FROM users'),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', today),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', today - 6 * 86_400),
    queryOne(db, 'SELECT COUNT(DISTINCT user_hash) AS count FROM events WHERE created_at >= ?', today - 29 * 86_400),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'app_open' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'search' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'material_open' AND created_at >= ?", start),
    queryOne(db, "SELECT COUNT(*) AS count FROM events WHERE event_type = 'yandex_disk_open' AND created_at >= ?", start),
  ])
  return { period, users: { total: total.count, today: day.count, days7: week.count, days30: month.count }, launches: launches.count, activity: { searches: searches.count, materialOpens: materialOpens.count, yandexDiskOpens: yandexDiskOpens.count } }
}

async function telegramStats(env, chatId) {
  const metrics = await summary(env.ANALYTICS_DB, unixNow(), '7d')
  const text = `📊 Статистика «Студент ИУ5»\n\n👥 Пользователи\nВсего: ${metrics.users.total}\nСегодня: ${metrics.users.today}\n7 дней: ${metrics.users.days7}\n30 дней: ${metrics.users.days30}\n\n🚀 Запуски\n7 дней: ${metrics.launches}\n\n📚 Открытий материалов за 7 дней: ${metrics.activity.materialOpens}\n🔎 Поисков за 7 дней: ${metrics.activity.searches}`
  const body = { chat_id: chatId, text }
  if (env.ADMIN_DASHBOARD_URL) body.reply_markup = { inline_keyboard: [[{ text: 'Открыть полную статистику', web_app: { url: env.ADMIN_DASHBOARD_URL } }]] }
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function webhook(request, env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response(null, { status: 401 })
  let update
  try { update = await request.json() } catch { return new Response(null, { status: 400 }) }
  const message = update?.message
  if (message?.text?.trim() === '/stats' && Number.isSafeInteger(message.from?.id) && adminIds(env).has(String(message.from.id))) await telegramStats(env, message.chat.id)
  return new Response('ok')
}

async function handle(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/telegram/webhook' && request.method === 'POST') return webhook(request, env)
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    const user = await identity(request, env)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (url.pathname === '/api/admin/me' && request.method === 'GET') return json({ isAdmin: user.isAdmin })
    if (url.pathname === '/api/analytics/open' && request.method === 'POST') { await trackOpen(env.ANALYTICS_DB, user.userHash, unixNow()); return new Response(null, { status: 204 }) }
    if (url.pathname === '/api/analytics/event' && request.method === 'POST') {
      const raw = await request.text()
      if (new TextEncoder().encode(raw).byteLength > 1024) return json({ error: 'Payload too large' }, 413)
      let event
      try { event = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
      if (!event || !eventTypes.has(event.type) || !validOptionalId(event.subjectId) || !validOptionalId(event.materialId) || Object.keys(event).some((key) => !['type', 'subjectId', 'materialId'].includes(key))) return json({ error: 'Invalid event' }, 400)
      await trackEvent(env.ANALYTICS_DB, user.userHash, event, unixNow())
      return new Response(null, { status: 204 })
    }
    if (!url.pathname.startsWith('/api/admin/')) return new Response('Not found', { status: 404 })
    if (!user.isAdmin) return json({ error: 'Forbidden' }, 403)
    const period = url.searchParams.get('period') ?? '30d'
    if (!(period in periods)) return json({ error: 'Invalid period' }, 400)
    const now = unixNow(), start = periodStart(period, now)
    if (url.pathname === '/api/admin/stats/summary' && request.method === 'GET') return json(await summary(env.ANALYTICS_DB, now, period))
    if (url.pathname === '/api/admin/stats/activity' && request.method === 'GET') return json({ period, days: await queryAll(env.ANALYTICS_DB, `SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS date, COUNT(DISTINCT user_hash) AS users, SUM(event_type = 'app_open') AS launches FROM events WHERE created_at >= ? GROUP BY date ORDER BY date`, Math.max(start, startOfUtcDay(now) - 29 * 86_400)) })
    const field = url.pathname.endsWith('/subjects') ? 'subject_id' : url.pathname.endsWith('/materials') ? 'material_id' : null
    if (field) return json({ period, items: await queryAll(env.ANALYTICS_DB, `SELECT ${field} AS id, COUNT(*) AS count FROM events WHERE ${field} != '' AND created_at >= ? GROUP BY ${field} ORDER BY count DESC, id LIMIT 10`, start) })
    return new Response('Not found', { status: 404 })
}

function withCors(request, env, response) {
  const origin = request.headers.get('Origin')
  if (origin && origin === (env.ANALYTICS_ALLOWED_ORIGIN ?? 'https://iu5hub.pages.dev')) {
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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
      return withCors(request, env, json({ error: 'Analytics unavailable' }, 503))
    }
  },
  async scheduled(_controller, env) {
    await env.ANALYTICS_DB.prepare('DELETE FROM events WHERE created_at < ?').bind(unixNow() - 90 * 86_400).run()
  },
}
