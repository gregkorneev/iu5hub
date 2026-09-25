import ICAL from 'ical.js'
import { readFile, readdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export const LKS = 'https://lks.bmstu.ru'
export const STRUCTURE = `${LKS}/lks-back/api/v1/structure`
export const MOSCOW = 'Europe/Moscow'

export function isNumeratorRefreshDue(anchor, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(anchor ?? '') || !/^\d{4}-\d{2}-\d{2}$/u.test(today ?? '')) return false
  const monday = (value) => {
    const date = new Date(`${value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    return date
  }
  const nextMonday = monday(today)
  if (nextMonday.toISOString().slice(0, 10) < today) nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)
  const weeks = Math.floor((nextMonday.getTime() - monday(anchor).getTime()) / 604800000)
  return weeks >= 0 && weeks % 2 === 0
}

export async function getJson(url) {
  let last
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Student-IU5-Schedule-Sync/1.0 (+https://github.com/gregkorneev/iu5hub)' }, signal: AbortSignal.timeout(20000) })
      if (response.status === 204) return null
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      last = error
      if (attempt < 2) await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)))
    }
  }
  throw last
}

export function findGroups(node, found = []) {
  if (!node || typeof node !== 'object') return found
  if (node.nodeType === 'group' && typeof node.abbr === 'string' && /^ИУ5-/u.test(node.abbr)) found.push({ name: node.abbr, sourceId: node.uuid })
  for (const child of node.children ?? []) findGroups(child, found)
  return found
}

export function slug(name) {
  return name.toLocaleLowerCase('ru').replace(/^иу5/u, 'iu5').replace(/[а-яё]/gu, (letter) => ({ а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'i', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' })[letter]).replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
}

export const moscowParts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: MOSCOW, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]))

export function parseCalendar(text) {
  if (!text.includes('BEGIN:VCALENDAR') || !text.includes('END:VCALENDAR')) throw new Error('Body is not a complete VCALENDAR')
  // LKS omits the value on ATTENDEE; add a non-routable placeholder so ical.js can retain its CN name.
  const compatible = text.replace(/^(ATTENDEE;CN="[^"]+")\r?$/gimu, '$1:mailto:lks.invalid@example.invalid')
  const root = new ICAL.Component(ICAL.parse(compatible))
  const components = root.getAllSubcomponents('vevent')
  const events = components.filter((component) => !component.hasProperty('recurrence-id')).map((component) => new ICAL.Event(component))
  for (const component of components.filter((item) => item.hasProperty('recurrence-id'))) {
    const uid = component.getFirstPropertyValue('uid')
    const parent = events.find((event) => event.uid === uid)
    if (!parent) throw new Error(`RECURRENCE-ID has no master event: ${uid}`)
    parent.relateException(new ICAL.Event(component))
  }
  if (!events.length) throw new Error('Calendar has no VEVENT')
  return { root, events }
}

const comparable = (value) => String(value ?? '').toLocaleLowerCase('ru').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '')
function matchingScheduleEntry(event, rows, weekday, time, summary) {
  const candidates = rows.filter((row) => row.day === weekday && row.startTime === time && row.discipline?.fullName === summary)
  if (candidates.length < 2) return candidates[0]
  const names = event.component.getAllProperties('attendee').map((property) => comparable(property.getParameter('cn'))).filter(Boolean)
  const location = comparable(event.location)
  const description = comparable(event.description)
  const typeLabels = { lecture: ['лекция'], seminar: ['семинар'], practice: ['практика', 'практическоезанятие'], laboratory: ['лабораторнаяработа', 'лабораторная'] }
  const scored = candidates.map((row) => {
    const teachers = (row.teachers ?? []).map((teacher) => comparable(teacher.lastName)).filter(Boolean)
    const rooms = (row.audiences ?? []).flatMap((audience) => [comparable(`${audience.building}, ${audience.name}`), comparable(audience.name)])
    const types = typeLabels[row.discipline?.actType] ?? []
    return { row, score: (names.some((name) => teachers.some((teacher) => name.includes(teacher))) ? 8 : 0) + (rooms.some((room) => location.includes(room) || room.includes(location)) ? 4 : 0) + (types.includes(description) ? 2 : 0) }
  }).sort((a, b) => b.score - a.score)
  return scored[0].score > 0 && scored[0].score !== scored[1].score ? scored[0].row : undefined
}

export function expandEvents(events, publicSchedule, rangeStart, rangeEnd) {
  const days = {}
  const anchors = []
  for (const event of events) {
    const start = event.startDate
    const end = event.endDate
    if (!start || !end) throw new Error(`VEVENT ${event.uid} has no DTSTART/DTEND`)
    const iterator = event.iterator()
    let firstOccurrence = true
    for (let occurrence = iterator.next(), guard = 0; occurrence && guard++ < 300; occurrence = iterator.next()) {
      const details = event.getOccurrenceDetails(occurrence)
      const begin = details.startDate.toJSDate()
      if (begin >= rangeEnd) break
      if (begin < rangeStart) continue
      const finish = details.endDate.toJSDate()
      const local = moscowParts(begin)
      const key = `${local.year}-${local.month}-${local.day}`
      const weekday = new Date(`${key}T12:00:00Z`).getUTCDay() || 7
      const time = `${local.hour}:${local.minute}`
      const item = details.item ?? event
      const summary = String(item.summary ?? '').trim()
      const sourceEntry = matchingScheduleEntry(event, publicSchedule, weekday, time, summary)
      const recur = event.component.getFirstPropertyValue('rrule')
      if (firstOccurrence && Number(recur?.interval ?? 1) === 2 && (sourceEntry?.week === 'zn' || sourceEntry?.week === 'ch')) {
        const monday = new Date(`${key}T00:00:00Z`)
        monday.setUTCDate(monday.getUTCDate() - weekday + 1 + (sourceEntry.week === 'zn' ? -7 : 0))
        anchors.push(monday.toISOString().slice(0, 10))
      }
      firstOccurrence = false
      const stop = moscowParts(finish)
      const desc = String(item.description ?? '').trim()
      const subject = {
        start: time,
        end: `${stop.hour}:${stop.minute}`,
        subject: summary,
        type: desc,
        teacher: sourceEntry?.teachers?.map((person) => [person.lastName, person.firstName?.[0] && `${person.firstName[0]}.`, person.middleName?.[0] && `${person.middleName[0]}.`].filter(Boolean).join(' ')).filter(Boolean).join(', ') || '',
        location: String(item.location ?? '').trim(),
      }
      ;(days[key] ??= []).push(subject)
    }
  }
  for (const values of Object.values(days)) values.sort((a, b) => a.start.localeCompare(b.start) || a.subject.localeCompare(b.subject, 'ru'))
  return { days, anchors: [...new Set(anchors)] }
}

export async function validateDataset(root) {
  const index = JSON.parse(await readFile(`${root}/groups.json`, 'utf8'))
  if (!Array.isArray(index.groups) || index.groups.length < 30) throw new Error('Invalid or incomplete groups.json')
  const files = await readdir(`${root}/groups`)
  if (files.length !== index.groups.length) throw new Error(`Group file count mismatch: ${files.length} != ${index.groups.length}`)
  const ids = new Set()
  for (const group of index.groups) {
    if (!/^iu5-[a-z0-9-]+$/u.test(group.id) || !/^ИУ5-/u.test(group.name) || ids.has(group.id)) throw new Error(`Invalid or duplicate group ${group.id}`)
    ids.add(group.id)
    const data = JSON.parse(await readFile(`${root}/groups/${group.id}.json`, 'utf8'))
    if (data.group?.id !== group.id || data.group?.name !== group.name || !data.source?.syncedAt || !['available', 'no-schedule'].includes(data.availability) || !data.days || typeof data.days !== 'object') throw new Error(`Invalid data for ${group.name}`)
    for (const [date, lessons] of Object.entries(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Array.isArray(lessons)) throw new Error(`Invalid day ${date} for ${group.name}`)
      const seen = new Set()
      for (const lesson of lessons) {
        if (!/^\d{2}:\d{2}$/u.test(lesson.start) || !/^\d{2}:\d{2}$/u.test(lesson.end) || !lesson.subject) throw new Error(`Invalid lesson in ${group.name} on ${date}`)
        const key = `${lesson.start}/${lesson.end}/${lesson.subject}`
        if (seen.has(key)) throw new Error(`Duplicate event ${key} in ${group.name} on ${date}`)
        seen.add(key)
      }
    }
  }
  return { index, count: files.length }
}

export async function replaceAtomically(staging, target) {
  const previous = `${target}.previous`
  await rm(previous, { recursive: true, force: true })
  const hadTarget = existsSync(target)
  if (hadTarget) await rename(target, previous)
  try {
    await rename(staging, target)
  } catch (error) {
    if (hadTarget && existsSync(previous) && !existsSync(target)) await rename(previous, target)
    throw error
  }
  await rm(previous, { recursive: true, force: true })
}

export function sameScheduleContent(left, right) {
  const select = (value) => JSON.stringify({ group: value.group, source: { provider: value.source?.provider, sourceId: value.source?.sourceId }, semester: value.semester, availability: value.availability, days: value.days })
  return select(left) === select(right)
}
