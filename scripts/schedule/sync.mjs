import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expandEvents, findGroups, getJson, isNumeratorRefreshDue, LKS, parseCalendar, replaceAtomically, sameScheduleContent, slug, STRUCTURE, validateDataset } from './common.mjs'

const output = resolve('public/data/schedule')
const backup = `${output}.previous`
const force = process.argv.includes('--force')
const checkOnly = process.argv.includes('--check')
const now = new Date()
const dateInMoscow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

const due = (anchor, date) => isNumeratorRefreshDue(anchor, date)
function mondayOf(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7))
  return value
}
function anchorFromIndex(index) {
  const candidates = index?.groups?.map((group) => group.weekOneStart).filter(Boolean) ?? []
  if (!candidates.length) return null
  const counts = new Map()
  for (const value of candidates) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}
function canonicalAnchor(candidates) {
  if (!candidates.length) return null
  const dates = candidates.map((value) => new Date(`${value}T00:00:00Z`)).sort((a, b) => a - b)
  const earliest = dates[0]
  const month = earliest.getUTCMonth() + 1
  const year = earliest.getUTCFullYear() - (month === 1 ? 1 : 0)
  const termStart = new Date(Date.UTC(year, month >= 8 || month === 1 ? 8 : 1, 1))
  const semesterMonday = mondayOf(termStart.toISOString().slice(0, 10))
  const base = dates[0]
  if (dates.some((date) => (Math.round((date - base) / 86400000) % 14) !== 0)) throw new Error(`LKS numerator/denominator assignments conflict: ${candidates.join(', ')}`)
  const offset = ((Math.round((base - semesterMonday) / 86400000) % 14) + 14) % 14
  semesterMonday.setUTCDate(semesterMonday.getUTCDate() + offset)
  return semesterMonday.toISOString().slice(0, 10)
}

if (!existsSync(output) && existsSync(backup)) await rename(backup, output)
let prior
try { prior = JSON.parse(await readFile(`${output}/groups.json`, 'utf8')) } catch { prior = null }
const cycleAnchor = anchorFromIndex(prior)
if (checkOnly) {
  console.log(`Cycle anchor: ${cycleAnchor ?? 'unknown'}`)
  console.log(`Next numerator refresh due: ${due(cycleAnchor, dateInMoscow) ? 'yes' : 'no'}`)
  process.exit(0)
}
if (!force && !due(cycleAnchor, dateInMoscow)) {
  console.log(`Schedule sync skipped before LKS request; cycle anchor ${cycleAnchor ?? 'unknown'}, next numerator is not due.`)
  process.exit(0)
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))
async function limited(items, limit, task) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await task(items[index], index)
      if (next < items.length) await wait(250)
    }
  }))
  return out
}
async function getText(url) {
  let last
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Student-IU5-Schedule-Sync/1.0 (+https://github.com/gregkorneev/iu5hub)' }, signal: AbortSignal.timeout(20000) })
      if (response.status === 204) return null
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      return { response, text: await response.text() }
    } catch (error) { last = error; if (attempt < 2) await wait(500 * (attempt + 1)) }
  }
  throw last
}
const structure = await getJson(STRUCTURE)
const groups = findGroups(structure.data).sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }))
if (groups.length < 30) throw new Error(`Unexpectedly few IU5 groups (${groups.length}); refusing to replace known-good data`)
console.log(`Discovered ${groups.length} IU5 groups`)
const lower = new Date(`${dateInMoscow}T00:00:00Z`)
lower.setUTCMonth(lower.getUTCMonth() - 1)
const upper = new Date(`${dateInMoscow}T00:00:00Z`)
upper.setUTCMonth(upper.getUTCMonth() + 6)
const generatedAt = new Date().toISOString()
const results = await limited(groups, 2, async (group) => {
  const id = slug(group.name)
  const api = await getJson(`${LKS}/lks-back/api/v1/schedules/groups/${group.sourceId}/public`)
  if (!api) return { group, data: { group: { id, name: group.name }, source: { provider: 'LKS BMSTU', syncedAt: generatedAt, sourceId: group.sourceId }, semester: { academicYear: '', term: 1, weekOneStart: cycleAnchor }, availability: 'no-schedule', days: {} }, noSchedule: true }
  if (!api.data?.link || api.data.uuid !== group.sourceId) throw new Error(`Unexpected public schedule metadata for ${group.name}`)
  if (!Array.isArray(api.data.schedule) || api.data.schedule.length === 0) return { group, data: { group: { id, name: group.name }, source: { provider: 'LKS BMSTU', syncedAt: generatedAt, sourceId: group.sourceId }, semester: { academicYear: '', term: 1, weekOneStart: cycleAnchor }, availability: 'no-schedule', days: {} }, noSchedule: true }
  const downloaded = await getText(api.data.link)
  if (!downloaded) return { group, data: { group: { id, name: group.name }, source: { provider: 'LKS BMSTU', syncedAt: generatedAt, sourceId: group.sourceId }, semester: { academicYear: '', term: 1, weekOneStart: cycleAnchor }, availability: 'no-schedule', days: {} }, noSchedule: true }
  let events
  try { ({ events } = parseCalendar(downloaded.text)) } catch (error) { throw new Error(`${group.name}: ${error.message}`) }
  const expanded = expandEvents(events, api.data.schedule ?? [], lower, upper)
  let anchor
  try { anchor = canonicalAnchor(expanded.anchors) ?? cycleAnchor } catch (error) { throw new Error(`${group.name}: ${error.message}`) }
  const anchorDate = anchor ? new Date(`${anchor}T00:00:00Z`) : lower
  const year = anchorDate.getUTCFullYear()
  const month = anchorDate.getUTCMonth() + 1
  const firstTerm = month >= 8 || month === 1
  const academicYear = firstTerm ? `${year}/${year + 1}` : `${year - 1}/${year}`
  const term = firstTerm ? 1 : 2
  return { group, data: { group: { id, name: group.name }, source: { provider: 'LKS BMSTU', syncedAt: generatedAt, sourceId: group.sourceId }, semester: { academicYear, term, weekOneStart: anchor }, availability: 'available', days: expanded.days }, noSchedule: false }
})
const validAnchors = results.map((result) => result.data.semester.weekOneStart).filter(Boolean)
const counts = new Map()
for (const anchor of validAnchors) counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
const sharedAnchor = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
for (const result of results) if (!result.data.semester.weekOneStart) result.data.semester.weekOneStart = sharedAnchor
const ids = new Set()
for (const { data } of results) {
  if (ids.has(data.group.id)) throw new Error(`Duplicate group id ${data.group.id}`)
  ids.add(data.group.id)
}
let index = { generatedAt, provider: 'LKS BMSTU', cycleAnchor: sharedAnchor, groups: results.map(({ group, data, noSchedule }) => ({ id: data.group.id, name: group.name, weekOneStart: data.semester.weekOneStart, hasSchedule: !noSchedule })).sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true })) }
if (prior && JSON.stringify(prior.groups) === JSON.stringify(index.groups) && prior.cycleAnchor === index.cycleAnchor) {
  let unchanged = true
  const oldSchedules = new Map()
  for (const item of index.groups) {
    try {
      const old = JSON.parse(await readFile(`${output}/groups/${item.id}.json`, 'utf8'))
      oldSchedules.set(item.id, old)
      if (!sameScheduleContent(old, results.find((result) => result.data.group.id === item.id).data)) unchanged = false
    } catch { unchanged = false }
  }
  if (unchanged) {
    index.generatedAt = prior.generatedAt
    for (const result of results) result.data.source.syncedAt = oldSchedules.get(result.data.group.id).source.syncedAt
    console.log('LKS schedule unchanged; preserving timestamps for a no-op commit.')
  }
}
const staging = `${output}.staging-${process.pid}`
await rm(staging, { recursive: true, force: true })
await mkdir(`${staging}/groups`, { recursive: true })
await writeFile(`${staging}/groups.json`, `${JSON.stringify(index, null, 2)}\n`)
for (const { data } of results) await writeFile(`${staging}/groups/${data.group.id}.json`, `${JSON.stringify(data, null, 2)}\n`)
await validateDataset(staging)
await replaceAtomically(staging, output)
console.log(`Generated ${results.length} groups (${results.filter((item) => !item.noSchedule).length} with calendars; ${results.filter((item) => item.noSchedule).length} with no public schedule); week-one anchor: ${sharedAnchor ?? 'unavailable'}`)
