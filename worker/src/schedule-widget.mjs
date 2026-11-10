import { hashTelegramUserId } from './telegram.mjs'

const encoder = new TextEncoder()
const ALLOWED_PAGE_ORIGINS = new Set(['https://iu5hub.pages.dev', 'https://beta.iu5hub.pages.dev'])
const DATA_TIMEOUT_MS = 3000
const RESPONSE_LIMIT = 1024

function bytes(value) { return encoder.encode(value).byteLength }
function validGroupId(value) { return typeof value === 'string' && /^iu5-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}
function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`
}
function addDays(date, count) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}
function inCurrentWeek(date, today) {
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  return date >= monday && date <= addDays(monday, 6)
}
function weekFor(date, weekOneStart) {
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${weekOneStart}T00:00:00Z`)) / 86_400_000)
  const week = Math.floor(days / 7) + 1
  return { week: week > 0 ? week : null, parity: week > 0 ? ((week - 1) % 2 === 0 ? 'Числитель' : 'Знаменатель') : null }
}
function validSchedule(value, groupId) {
  return value && typeof value === 'object' && value.group?.id === groupId && typeof value.group?.name === 'string' &&
    ['available', 'unavailable'].includes(value.availability) && value.semester && validDate(value.semester.weekOneStart) &&
    value.days && typeof value.days === 'object' && !Array.isArray(value.days) &&
    Object.entries(value.days).every(([date, lessons]) => validDate(date) && Array.isArray(lessons) && lessons.every((lesson) =>
      lesson && typeof lesson.start === 'string' && typeof lesson.end === 'string' && typeof lesson.subject === 'string' &&
      typeof lesson.type === 'string' && typeof lesson.teacher === 'string' && typeof lesson.location === 'string'))
}
function pageOrigin(env) {
  const origin = env.ANALYTICS_ALLOWED_ORIGIN
  if (!ALLOWED_PAGE_ORIGINS.has(origin)) throw new Error('schedule_origin_unavailable')
  return origin
}
function appScheduleUrl(env) { return `${pageOrigin(env)}/#/schedule` }
async function loadJson(env, path) {
  const response = await fetch(`${pageOrigin(env)}${path}`, { signal: AbortSignal.timeout(DATA_TIMEOUT_MS) })
  if (!response.ok) throw new Error('schedule_source_unavailable')
  return response.json()
}
async function loadUserSchedule(env, userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !env.USER_ID_HMAC_SECRET || !env.ANALYTICS_DB) return { error: 'unavailable' }
  const owner = await hashTelegramUserId(String(userId), env.USER_ID_HMAC_SECRET)
  const row = await env.ANALYTICS_DB.prepare('SELECT schedule_group_id AS groupId FROM profile_preferences WHERE user_hash = ?').bind(owner).first()
  if (!row?.groupId) return { error: 'no_group' }
  if (!validGroupId(row.groupId)) return { error: 'invalid_group' }
  const groups = await loadJson(env, '/data/schedule/groups.json')
  const group = groups?.groups?.find((item) => item?.id === row.groupId)
  if (!group) return { error: 'missing_group' }
  const schedule = await loadJson(env, `/data/schedule/groups/${row.groupId}.json`)
  if (!validSchedule(schedule, row.groupId)) return { error: 'invalid_schedule' }
  return { group, schedule }
}
function lessonItem(lesson) {
  return { s: lesson.start, e: lesson.end, n: lesson.subject, t: lesson.type, ...(lesson.teacher ? { p: lesson.teacher } : {}), ...(lesson.location ? { a: lesson.location } : {}) }
}
export function buildScheduleDay(group, schedule, date, page = 0, backToWeek = false) {
  const info = weekFor(date, schedule.semester.weekOneStart)
  const lessons = schedule.availability === 'available' ? (schedule.days[date] ?? []).map(lessonItem) : []
  const base = { v: 'd', k: backToWeek ? 'day' : 'today', g: group.name, d: date, w: info.week, p: info.parity, u: schedule.source?.syncedAt ?? '', i: 0, c: 1, l: [], b: backToWeek ? 1 : 0 }
  if (schedule.availability !== 'available') return { ...base, x: 'unpublished' }
  const pages = []
  let current = []
  for (const lesson of lessons) {
    const candidate = { ...base, i: pages.length, c: 1, l: [...current, lesson] }
    if (current.length >= 4 || bytes(JSON.stringify(candidate)) > RESPONSE_LIMIT) {
      if (!current.length) return { ...base, x: 'oversize' }
      pages.push(current); current = [lesson]
    } else current.push(lesson)
  }
  if (current.length || !lessons.length) pages.push(current)
  const count = pages.length
  const index = Math.min(Math.max(0, page), count - 1)
  return { ...base, i: index, c: count, l: pages[index] }
}
export function buildScheduleWeek(group, schedule, date) {
  const monday = addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7))
  const info = weekFor(monday, schedule.semester.weekOneStart)
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const days = names.map((name, index) => {
    const day = addDays(monday, index)
    const lessons = schedule.availability === 'available' ? (schedule.days[day] ?? []) : []
    return [name, day, lessons.length, lessons[0]?.start ?? '']
  })
  return { v: 'w', k: 'week', g: group.name, d: date, w: info.week, p: info.parity, u: schedule.source?.syncedAt ?? '', x: schedule.availability === 'available' ? '' : 'unpublished', l: days }
}
function responseData(value) {
  const result = JSON.stringify(value)
  if (bytes(result) > RESPONSE_LIMIT) throw new Error('widget_answer_too_large')
  return result
}

export function scheduleWidgetHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light dark;font:15px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--tg-theme-text-color,#222);background:var(--tg-theme-bg-color,#fff)}*{box-sizing:border-box}body{margin:0;padding:12px;max-width:100%;overflow-wrap:anywhere}.head{margin:0 0 10px}.title{font-weight:700;font-size:18px}.meta{color:var(--tg-theme-hint-color,#888);font-size:13px;margin-top:2px}.tabs{display:flex;gap:5px;margin:10px 0 12px}.tabs button,.weekday,.pager{font:inherit;color:var(--tg-theme-text-color,#222);background:var(--tg-theme-secondary-bg-color,#f2f2f7);border:0;border-radius:9px;padding:8px 7px}.tabs button{flex:1;font-size:13px}.tabs button.active{color:var(--tg-theme-button-text-color,#fff);background:var(--tg-theme-button-color,#2481cc)}.lesson{padding:10px 0;border-top:1px solid var(--tg-theme-hint-color,#888)}.time{font-size:16px;font-weight:700;letter-spacing:.2px}.subject{font-weight:600;margin-top:3px}.detail{font-size:13px;color:var(--tg-theme-hint-color,#888);margin-top:2px}.empty{padding:12px 0;color:var(--tg-theme-hint-color,#888)}.foot{font-size:11px;color:var(--tg-theme-hint-color,#888);margin-top:8px}.week{display:grid;gap:5px}.weekday{display:flex;align-items:center;justify-content:space-between;text-align:left;width:100%}.weekday small{color:var(--tg-theme-hint-color,#888)}.pager{width:100%;margin-top:8px}.error{color:var(--tg-theme-destructive-text-color,#d44)}
</style></head><body><main id="app"></main><script>
const root=document.getElementById('app');let state=null,busy=false;
function esc(s){return String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function dayTitle(d){const p=String(d).split('-');return Number(p[2])+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][Number(p[1])-1]}
function draw(){if(!state){root.innerHTML='<div class="empty">Не удалось загрузить расписание. Нажмите «Сегодня», чтобы повторить.</div>'+tabs('');return}const group='<header class="head"><div class="title">📅 Расписание</div><div class="meta">'+esc(state.g)+' · '+esc(dayTitle(state.d))+(state.w?' · '+esc(state.w)+'-я неделя'+(state.p?' · '+esc(state.p):''):'')+'</div></header>';let body='';if(state.x==='unpublished')body='<div class="empty">Расписание пока не опубликовано.</div>';else if(state.x==='oversize')body='<div class="empty error">Не удалось отобразить слишком длинное название занятия.</div>';else if(state.v==='w'){body=state.x?'<div class="empty">Расписание пока не опубликовано.</div>':'<div class="week">'+state.l.map(x=>'<button class="weekday" data-action="day:'+esc(x[1])+'"><span>'+esc(x[0])+' · '+esc(dayTitle(x[1]))+'</span><small>'+x[2]+' пар'+(x[3]?' · '+esc(x[3]):'')+'</small></button>').join('')+'</div>'}else if(!state.l.length)body='<div class="empty">'+(state.x==='unpublished'?'Расписание пока не опубликовано.':'Занятий нет.')+'</div>';else body=state.l.map(x=>'<article class="lesson"><div class="time">'+esc(x.s)+' — '+esc(x.e)+'</div><div class="subject">'+esc(x.n)+'</div><div class="detail">'+esc(x.t)+(x.p?' · '+esc(x.p):'')+(x.a?' · '+esc(x.a):'')+'</div></article>').join('')+(state.c>1?'<button class="pager" data-action="page:'+esc(state.d)+':'+(state.i+1)+'">Ещё занятия · '+(state.i+1)+'/'+state.c+'</button>':'');root.innerHTML=group+tabs(state.k==='week'?'week':state.k==='tomorrow'?'tomorrow':state.k==='today'?'today':'')+(state.b?'<button class="pager" data-action="week">← К неделе</button>':'')+body+'<div class="foot">Обновлено: '+esc(state.u?String(state.u).slice(0,10):'дата не указана')+'</div>'}
function tabs(active){return '<nav class="tabs"><button class="'+(active==='today'?'active':'')+'" data-action="today">Сегодня</button><button class="'+(active==='tomorrow'?'active':'')+'" data-action="tomorrow">Завтра</button><button class="'+(active==='week'?'active':'')+'" data-action="week">Неделя</button></nav>'}
function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value+'-'+p.find(x=>x.type==='day').value}function tomorrow(){const d=new Date(today()+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}
root.addEventListener('click',e=>{let b=e.target;while(b&&b!==root&&!b.dataset.action)b=b.parentElement;if(!b||b===root||busy)return;const action=b.dataset.action;if(!window.TelegramWidget?.request){root.innerHTML+='<div class="empty">Откройте расписание в приложении «Студент ИУ5».</div>';return}busy=true;const label=b.textContent;b.disabled=true;b.textContent='Загрузка…';const request=window.TelegramWidget.request(action);request.then(answer=>{state=JSON.parse(answer.result);draw()},err=>{b.disabled=false;b.textContent=label;root.innerHTML+='<div class="empty error">Не удалось обновить. Нажмите ещё раз.</div>'}).finally(()=>{busy=false})});
try{const W=window.TelegramWidget;if(W){W.onEvent('chatDataChanged',()=>{try{state=JSON.parse(W.chatData);draw()}catch{}});state=W.chatData?JSON.parse(W.chatData):null}}catch{}draw();
</script></body></html>`
}

export async function sendScheduleWidget(env, chatId, userId, updateId) {
  try {
    const found = await loadUserSchedule(env, userId)
    if (found.error) {
      const messages = { no_group: 'Сначала выберите учебную группу в приложении «Студент ИУ5».', missing_group: 'Выбранная учебная группа больше не доступна. Измените выбор в приложении «Студент ИУ5».', invalid_group: 'Не удалось проверить учебную группу. Измените её в приложении «Студент ИУ5».', unavailable: 'Сервис расписания временно недоступен. Попробуйте позже.', invalid_schedule: 'Расписание временно недоступно. Попробуйте позже.' }
      await callTelegram(env, 'sendMessage', { chat_id: chatId, text: messages[found.error] ?? messages.unavailable, disable_notification: true, reply_markup: { inline_keyboard: [[{ text: 'Открыть расписание в приложении', web_app: { url: appScheduleUrl(env) } }]] } })
      return
    }
    const date = localDate()
    const html = scheduleWidgetHtml()
    // The document is deliberately compact; tests also verify zlib level-9 size before release.
    if (bytes(html) > 32_768) throw new Error('widget_html_too_large')
    const chatData = responseData(buildScheduleDay(found.group, found.schedule, date))
    await callTelegram(env, 'sendWidget', { chat_id: chatId, html, chat_data: chatData, allow_queries: true, disable_notification: true, caption: '📅 Расписание. Если виджет не отображается, откройте приложение.', reply_markup: { keyboard: [[{ text: '📅 Расписание' }, { text: 'Открыть приложение', web_app: { url: appScheduleUrl(env) } }]], resize_keyboard: true, is_persistent: true } })
  } catch (error) {
    console.error('schedule_widget_send_failed', { updateId, reason: error instanceof Error ? error.message : 'unknown' })
    try { await callTelegram(env, 'sendMessage', { chat_id: chatId, text: 'Не удалось загрузить расписание. Попробуйте ещё раз позже.', disable_notification: true, reply_markup: { inline_keyboard: [[{ text: 'Открыть расписание в приложении', web_app: { url: appScheduleUrl(env) } }]] } }) } catch {}
  }
}

async function callTelegram(env, method, payload, timeoutMs = 8000) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) })
  const result = await response.json()
  if (!response.ok || !result?.ok) throw new Error(`telegram_${method}_failed_${result?.error_code ?? response.status}`)
  return result.result
}

export async function handleScheduleWidgetQuery(env, query) {
  if (!query || typeof query.id !== 'string' || query.id.length > 128) return
  try {
    const userId = query.from?.id
    if (!Number.isSafeInteger(userId) || userId <= 0 || query.chat?.type !== 'private' || query.chat.id !== userId || !Number.isSafeInteger(query.message_id) || typeof query.data !== 'string' || bytes(query.data) > 64) throw new Error('invalid_context')
    const found = await loadUserSchedule(env, userId)
    if (found.error) throw new Error('schedule_unavailable')
    const date = localDate()
    let result
    if (query.data === 'today') result = buildScheduleDay(found.group, found.schedule, date)
    else if (query.data === 'tomorrow') result = { ...buildScheduleDay(found.group, found.schedule, addDays(date, 1)), k: 'tomorrow' }
    else if (query.data === 'week') result = buildScheduleWeek(found.group, found.schedule, date)
    else {
      const day = /^day:(\d{4}-\d{2}-\d{2})$/.exec(query.data)
      const page = /^page:(\d{4}-\d{2}-\d{2}):(\d{1,2})$/.exec(query.data)
      if (day && validDate(day[1]) && inCurrentWeek(day[1], date)) result = buildScheduleDay(found.group, found.schedule, day[1], 0, true)
      else if (page && validDate(page[1]) && inCurrentWeek(page[1], date) && Number(page[2]) < 100) result = buildScheduleDay(found.group, found.schedule, page[1], Number(page[2]), true)
      else throw new Error('invalid_action')
    }
    await callTelegram(env, 'answerWidgetQuery', { widget_query_id: query.id, data: responseData(result) }, 4500)
  } catch (error) {
    console.warn('schedule_widget_query_failed', { queryId: query.id.slice(0, 8), reason: error instanceof Error ? error.message : 'unknown' })
    try { await callTelegram(env, 'answerWidgetQuery', { widget_query_id: query.id, data: JSON.stringify({ e: 'retry' }) }, 4500) } catch {}
  }
}
