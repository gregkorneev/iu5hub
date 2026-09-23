import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { dataDir, maxPriority, normalize, parseBoolean, parseCsv, readCourses, readTable, stringifyCsv, tagColumns, writeTable } from './common.mjs'
import { createQueue, queueColumns, queueStatus } from './tagging-queue.mjs'

const canonicalPath = new URL('search-tags.csv', dataDir)
const queuePath = new URL('tagging-queue.csv', dataDir)
const manual = ['aliases', 'keywords', 'priority', 'inherit', 'notes']
const machine = ['course_id', 'course_title', 'type', 'path', 'name', 'source_status']
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

export function validateQueueAndApply(canonical, queue) {
  const byKey = new Map(canonical.map((row) => [row.object_key, row]))
  if (byKey.size !== canonical.length) throw new Error('Canonical table has duplicate object_key values')
  const seen = new Set()
  const changes = []
  for (const submitted of queue) {
    if (seen.has(submitted.object_key)) throw new Error(`Queue has duplicate object_key: ${submitted.object_key}`)
    seen.add(submitted.object_key)
    const original = byKey.get(submitted.object_key)
    if (!original) throw new Error(`Unknown object_key in queue: ${submitted.object_key}`)
    const depth = Math.max(0, original.path.split('/').filter(Boolean).length - 1)
    const expected = { ...original }
    for (const field of machine) if (submitted[field] !== String(expected[field] ?? '')) throw new Error(`${submitted.object_key}: machine field ${field} does not match the current catalog`)
    if (submitted.type !== 'folder' || submitted.source_status !== 'active') throw new Error(`${submitted.object_key}: only active folders may be applied from the tagging queue`)
    parseBoolean(submitted.enabled)
    if (String(submitted.depth) !== String(depth)) throw new Error(`${submitted.object_key}: depth does not match the current path`)
    if (submitted.status !== queueStatus(depth)) throw new Error(`${submitted.object_key}: status does not match the current path depth`)
    const updated = { ...original }
    for (const field of [...manual, 'enabled']) updated[field] = submitted[field]
    validateManual(updated, submitted.object_key)
    byKey.set(submitted.object_key, updated)
    changes.push(updated)
  }
  return { records: canonical.map((row) => byKey.get(row.object_key)), changes }
}

function validateManual(row, key) {
  if (!/^\d+$/.test(row.priority) || !Number.isSafeInteger(Number(row.priority)) || Number(row.priority) > maxPriority) throw new Error(`${key}: priority must be an integer from 0 to ${maxPriority}`)
  parseBoolean(row.inherit)
  for (const field of ['aliases', 'keywords']) {
    if (row[field].length > 2000) throw new Error(`${key}: ${field} is too long`)
    const terms = row[field] ? row[field].split(';').map((item) => item.trim()) : []
    if (terms.some((term) => !term)) throw new Error(`${key}: ${field} contains an empty item`)
    if (terms.some((term) => term.length > 120)) throw new Error(`${key}: ${field} has an item longer than 120 characters`)
    if (new Set(terms.map(normalize)).size !== terms.length) throw new Error(`${key}: ${field} contains duplicate normalized items`)
  }
  if (row.notes.length > 2000) throw new Error(`${key}: notes is too long`)
  for (const field of manual) if (controls.test(row[field] ?? '')) throw new Error(`${key}: ${field} contains a control character`)
}

export async function applyTags({ tagsPath = canonicalPath, queuePath: inputQueue = queuePath } = {}) {
  const canonical = await readTable(tagsPath, tagColumns)
  let parsed
  try { parsed = parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(await readFile(inputQueue))) }
  catch (error) { throw new Error(`Tagging queue is not valid UTF-8 CSV: ${error.message}`) }
  if (parsed.headers.join('\0') !== queueColumns.join('\0')) throw new Error(`Tagging queue must have columns: ${queueColumns.join(', ')}`)
  const { records, changes } = validateQueueAndApply(canonical, parsed.records)
  const path = resolve(tagsPath instanceof URL ? tagsPath.pathname : tagsPath)
  const queueFilePath = resolve(inputQueue instanceof URL ? inputQueue.pathname : inputQueue)
  const allMode = parsed.records.some(({ status }) => status === 'root' || status === 'later')
  const courses = await readCourses()
  const nextQueue = stringifyCsv(queueColumns, createQueue(records, { all: allMode, courseIds: courses.map(({ id }) => id) }))
  const tempPath = `${path}.${randomUUID()}.tmp`
  const tempQueuePath = `${queueFilePath}.${randomUUID()}.tmp`
  try {
    await writeTable(tempPath, tagColumns, records)
    await writeFile(tempQueuePath, nextQueue, 'utf8')
    await rename(tempPath, path)
    await rename(tempQueuePath, queueFilePath)
  } finally { await Promise.all([rm(tempPath, { force: true }), rm(tempQueuePath, { force: true })]) }
  console.log(`Applied ${changes.length} tagging queue row(s).`)
  return changes.length
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) applyTags().catch((error) => { console.error(error.message); process.exitCode = 1 })
