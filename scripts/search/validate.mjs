import { maxPriority, readCourses, readSynonymTable, readTable, tagColumns, dataDir, normalize, parseBoolean } from './common.mjs'

const fail = (message) => console.error(`ERROR: ${message}`)
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
const checkList = (value, label, errors) => {
  if (value.length > 2000) errors.push(`${label}: field exceeds 2000 characters`)
  if (!value) return
  const parts = value.split(';').map((part) => part.trim())
  if (parts.some((part) => !part)) errors.push(`${label}: empty list item (check ;; or a trailing ;)`)
  if (parts.some((part) => part.length > 120)) errors.push(`${label}: item exceeds 120 characters`)
  const normalized = parts.map(normalize)
  if (new Set(normalized).size !== normalized.length) errors.push(`${label}: duplicate items after normalization`)
}

export async function validate(directory = dataDir) {
  const errors = []
  let rows, synonyms
  try { rows = await readTable(new URL('search-tags.csv', directory), tagColumns) } catch (error) { errors.push(`search-tags.csv: ${error.message}`) }
  try { synonyms = await readSynonymTable(new URL('search-synonyms.csv', directory)) } catch (error) { errors.push(`search-synonyms.csv: ${error.message}`) }
  if (rows) {
    const courses = await readCourses(); const ids = new Set(courses.map(({ id }) => id)); const keys = new Set()
    rows.forEach((row, index) => {
      const label = `search-tags.csv row ${index + 2}`
      for (const field of ['object_key', 'course_id', 'type', 'path', 'name', 'source_status']) if (!row[field]?.trim()) errors.push(`${label}: ${field} is required`)
      if (!ids.has(row.course_id)) errors.push(`${label}: unknown course_id "${row.course_id}"`)
      if (!['folder', 'file'].includes(row.type)) errors.push(`${label}: type must be folder or file`)
      if (!['active', 'missing'].includes(row.source_status)) errors.push(`${label}: source_status must be active or missing`)
      if (keys.has(row.object_key)) errors.push(`${label}: duplicate object_key "${row.object_key}"`); keys.add(row.object_key)
      if (!/^\d+$/.test(row.priority) || !Number.isSafeInteger(Number(row.priority)) || Number(row.priority) > maxPriority) errors.push(`${label}: priority must be an integer from 0 to ${maxPriority}`)
      try { parseBoolean(row.enabled) } catch { errors.push(`${label}: enabled must be TRUE or FALSE`) }
      try { parseBoolean(row.inherit) } catch { errors.push(`${label}: inherit must be TRUE or FALSE`) }
      checkList(row.aliases, `${label} aliases`, errors); checkList(row.keywords, `${label} keywords`, errors)
      for (const field of tagColumns) if (controls.test(row[field] ?? '')) errors.push(`${label}: ${field} contains a control character`)
      if (row.path.length > 1000) errors.push(`${label}: path exceeds 1000 characters`)
    })
  }
  if (synonyms) {
    const synonymKeys = new Set()
    synonyms.forEach((row, index) => {
    const label = `search-synonyms.csv row ${index + 2}`
    if (!row.term.trim()) errors.push(`${label}: term is required`)
    if (!row.object_key?.trim()) errors.push(`${label}: object_key is required`)
    if (synonymKeys.has(row.object_key)) errors.push(`${label}: duplicate object_key`)
    synonymKeys.add(row.object_key)
    try { parseBoolean(row.enabled) } catch { errors.push(`${label}: enabled must be TRUE or FALSE`) }
    checkList(row.synonyms, `${label} synonyms`, errors)
    for (const field of synonymColumns) if (controls.test(row[field] ?? '')) errors.push(`${label}: ${field} contains a control character`)
    })
  }
  for (const message of errors) fail(message)
  if (errors.length) return false
  console.log(`Search metadata valid: ${(rows ?? []).length} objects, ${(synonyms ?? []).length} synonym entries.`)
  return true
}
if (process.argv[1]?.endsWith('/validate.mjs') && !(await validate())) process.exitCode = 1
