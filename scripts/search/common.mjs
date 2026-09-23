import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const tagColumns = ['object_key', 'course_id', 'course_title', 'type', 'path', 'name', 'aliases', 'keywords', 'priority', 'enabled', 'inherit', 'notes', 'source_status']
export const synonymColumns = ['term', 'synonyms', 'enabled', 'notes', 'object_key']
export const legacySynonymColumns = ['term', 'synonyms', 'enabled', 'notes']
export const manualColumns = ['aliases', 'keywords', 'priority', 'enabled', 'inherit', 'notes']
export const maxPriority = 2_147_483_647

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') {
      if (cell) throw new Error(`Unexpected quote at character ${i + 1}`)
      quoted = true
    } else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('Unclosed quoted CSV field')
  if (cell || row.length) { row.push(cell); if (row.some((value) => value !== '')) rows.push(row) }
  if (!rows.length) return { headers: [], records: [] }
  const [headers, ...data] = rows
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) throw new Error('CSV headers must be non-empty and unique')
  return { headers, records: data.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${cells.length} fields; expected ${headers.length}`)
    return Object.fromEntries(headers.map((header, column) => [header, cells[column]]))
  }) }
}

export const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
export function stringifyCsv(headers, records) {
  return `${[headers, ...records.map((record) => headers.map((header) => record[header] ?? ''))].map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}
export const objectKeyForPath = (courseId, path) => `${courseId}:${createHash('sha256').update(`${courseId}\0${path}`).digest('hex').slice(0, 16)}`
export const splitList = (value) => value.split(';').map((item) => item.trim()).filter(Boolean)
export const normalize = (value) => value.normalize('NFC').trim().toLocaleLowerCase('ru')
export const parseBoolean = (value) => {
  if (/^true$/i.test(value.trim())) return true
  if (/^false$/i.test(value.trim())) return false
  throw new Error(`Expected TRUE or FALSE, got "${value}"`)
}
export const defaultInherit = (type) => type === 'folder' ? 'TRUE' : 'FALSE'
export const synonymKeyForTerm = (term) => `synonym:${createHash('sha256').update(normalize(term)).digest('hex').slice(0, 20)}`

// The config is intentionally read from courses.ts so the sync uses the same source as the app.
export async function readCourses() {
  const source = await readFile(new URL('../../src/data/courses.ts', import.meta.url), 'utf8')
  return [...source.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'[^\n]*?publicUrl:\s*'([^']*)'/g)]
    .map(([, id, title, publicUrl]) => ({ id, title, publicUrl }))
}
export async function readTable(path, expectedHeaders) {
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)) }
  catch (error) { throw new Error(`invalid UTF-8 (${error.message})`) }
  const parsed = parseCsv(text)
  if (expectedHeaders && parsed.headers.join('\0') !== expectedHeaders.join('\0')) throw new Error(`${path}: expected columns ${expectedHeaders.join(', ')}`)
  return parsed.records
}
export async function readSynonymTable(path) {
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)) }
  catch (error) { throw new Error(`invalid UTF-8 (${error.message})`) }
  const parsed = parseCsv(text)
  if (parsed.headers.join('\0') === synonymColumns.join('\0')) return parsed.records
  if (parsed.headers.join('\0') !== legacySynonymColumns.join('\0')) throw new Error(`${path}: expected columns ${synonymColumns.join(', ')}`)
  return parsed.records.map((row) => ({ ...row, object_key: synonymKeyForTerm(row.term) }))
}
export async function migrateSynonymTable(path) {
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)) }
  catch (error) { throw new Error(`invalid UTF-8 (${error.message})`) }
  const parsed = parseCsv(text)
  if (parsed.headers.join('\0') === synonymColumns.join('\0')) return parsed.records
  if (parsed.headers.join('\0') !== legacySynonymColumns.join('\0')) throw new Error(`${path}: expected columns ${synonymColumns.join(', ')}`)
  const records = parsed.records.map((row) => ({ ...row, object_key: synonymKeyForTerm(row.term) }))
  await writeTable(path, synonymColumns, records)
  return records
}
export async function writeTable(path, headers, records) {
  await writeFile(path, stringifyCsv(headers, records), 'utf8')
}
export const dataDir = new URL('../../data/search/', import.meta.url)
