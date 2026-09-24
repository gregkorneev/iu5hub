import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { dataDir, parseBoolean, readCourses, readTable, stringifyCsv, tagColumns } from './common.mjs'

export const queueColumns = ['object_key', 'course_id', 'course_title', 'type', 'path', 'name', 'depth', 'status', 'source_status', 'enabled', 'aliases', 'keywords', 'teacher', 'priority', 'inherit', 'notes']
export const legacyQueueColumns = queueColumns.filter((field) => field !== 'teacher')
export const queueStatus = (depth) => depth === 0 ? 'root' : depth === 2 ? 'priority' : 'later'
const source = new URL('search-tags.csv', dataDir)
const destination = new URL('tagging-queue.csv', dataDir)

export function createQueue(rows, { all = false, courseIds = [...new Set(rows.map(({ course_id }) => course_id))] } = {}) {
  const selected = rows.filter((row) => {
    if (row.type !== 'folder' || row.source_status !== 'active' || !parseBoolean(row.enabled)) return false
    const depth = Math.max(0, row.path.split('/').filter(Boolean).length - 1)
    return all || depth === 2
  }).map((row) => {
    const depth = Math.max(0, row.path.split('/').filter(Boolean).length - 1)
    return { ...Object.fromEntries(queueColumns.map((field) => [field, row[field] ?? ''])), depth, status: queueStatus(depth) }
  })
  const courseOrder = new Map(courseIds.map((id, index) => [id, index]))
  return selected.sort((a, b) => courseOrder.get(a.course_id) - courseOrder.get(b.course_id) || a.depth - b.depth || a.path.localeCompare(b.path, 'ru'))
}

export async function generateQueue({ all = false, check = false, tagsPath = source, queuePath = destination } = {}) {
  const rows = await readTable(tagsPath, tagColumns)
  const courses = await readCourses()
  const records = createQueue(rows, { all, courseIds: courses.map(({ id }) => id) })
  const expected = stringifyCsv(queueColumns, records)
  if (check) {
    let current = ''
    try { current = await readFile(queuePath, 'utf8') } catch {}
    if (current !== expected) throw new Error('Tagging queue is stale; run npm run search:tagging-queue')
    console.log(`Tagging queue is up to date (${records.length} ${all ? 'all' : 'priority'} folders).`)
  } else {
    await writeFile(queuePath, expected, 'utf8')
    console.log(`Generated tagging queue with ${records.length} ${all ? 'all' : 'priority'} folders.`)
  }
  return records
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  generateQueue({ all: process.argv.includes('--all'), check: process.argv.includes('--check') }).catch((error) => { console.error(error.message); process.exitCode = 1 })
}
