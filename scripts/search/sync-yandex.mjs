import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defaultInherit, legacyTagColumns, manualColumns, objectKeyForPath, parseCsv, readCourses, tagColumns, writeTable } from './common.mjs'

const output = resolve(new URL('../../data/search/search-tags.csv', import.meta.url).pathname)
const api = 'https://cloud-api.yandex.net/v1/disk/public/resources'

export async function inventoryCourse(course, fetcher = fetch) {
  const get = async (path, offset = 0) => {
    const params = new URLSearchParams({ public_key: course.publicUrl, limit: '1000' })
    if (path) params.set('path', path)
    if (offset) params.set('offset', String(offset))
    const response = await fetcher(`${api}?${params}`)
    if (!response.ok) throw new Error(`${course.id}: Yandex Disk returned HTTP ${response.status} for ${path || '(root)'}`)
    return response.json()
  }
  const root = await get('')
  if (!root.name || root.type !== 'dir') throw new Error(`${course.id}: public link did not resolve to a folder`)
  const records = [{ object_key: objectKeyForPath(course.id, root.name), course_id: course.id, course_title: course.title, type: 'folder', path: root.name, name: root.name }]
  const pending = [{ apiPath: '', displayPath: root.name, firstPage: root }]
  while (pending.length) {
    const batch = pending.splice(0, 8)
    const children = await Promise.all(batch.map(async (folder) => {
      const found = []
      for (let offset = 0; ; offset += 1000) {
        const data = offset === 0 && folder.firstPage ? folder.firstPage : await get(folder.apiPath, offset)
        const items = data._embedded?.items ?? []
        found.push(...items)
        if (items.length < 1000) break
      }
      return { folder, items: found }
    }))
    for (const { folder, items } of children) {
      for (const item of items) {
        if (!item.name || !['dir', 'file'].includes(item.type)) continue
        const path = `${folder.displayPath}/${item.name}`
        const record = { object_key: objectKeyForPath(course.id, path), course_id: course.id, course_title: course.title, type: item.type === 'dir' ? 'folder' : 'file', path, name: item.name }
        records.push(record)
        if (item.type === 'dir') pending.push({ apiPath: item.path ?? path, displayPath: path })
      }
    }
  }
  return records
}

export function mergeInventory(current, inventory) {
  const previous = new Map(current.map((row) => [row.object_key, row]))
  const seen = new Set()
  const merged = inventory.map((object) => {
    const old = previous.get(object.object_key); seen.add(object.object_key)
    return { ...object, ...Object.fromEntries(manualColumns.map((field) => [field, old?.[field] ?? (field === 'priority' ? '0' : field === 'enabled' ? 'TRUE' : field === 'inherit' ? defaultInherit(object.type) : '')])), source_status: 'active' }
  })
  for (const row of current) if (!seen.has(row.object_key)) merged.push({ teacher: '', ...row, inherit: row.inherit ?? defaultInherit(row.type), source_status: 'missing' })
  return merged
}

export async function sync({ fetcher = fetch, input = output } = {}) {
  const courses = await readCourses()
  const active = courses.filter(({ publicUrl }) => /^https:\/\/disk\.yandex\.(?:ru|com)\/(?:d|i)\//.test(publicUrl))
  if (!active.length) throw new Error('No valid public Yandex Disk course links found')
  const priorBytes = await import('node:fs/promises').then(({ readFile }) => readFile(input))
  const prior = parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(priorBytes))
  if (prior.headers.join('\0') !== tagColumns.join('\0') && !legacyTagColumns.some((headers) => prior.headers.join('\0') === headers.join('\0'))) {
    throw new Error(`search-tags.csv must have the current columns or a supported legacy schema without teacher: ${legacyTagColumns.map((headers) => headers.join(', ')).join(' OR ')}`)
  }
  const existing = prior.records
  const inventory = (await Promise.all(active.map((course) => inventoryCourse(course, fetcher)))).flat()
  const merged = mergeInventory(existing, inventory)
  await mkdir(new URL('../../data/search/', import.meta.url), { recursive: true })
  await writeTable(input, tagColumns, merged)
  const activeKeys = new Set(inventory.map(({ object_key }) => object_key))
  const missing = merged.filter(({ source_status }) => source_status === 'missing')
  console.log(`Synced ${inventory.length} objects from ${active.length} course(s); preserved ${missing.length} missing row(s).`)
  for (const row of missing) console.warn(`WARNING: missing on Yandex Disk: ${row.course_id} ${row.path}; manual metadata preserved.`)
  // Same-parent/type names are advisory only; tags are never migrated by this heuristic.
  for (const old of missing) {
    const parent = old.path.split('/').slice(0, -1).join('/')
    const possible = inventory.filter((row) => row.course_id === old.course_id && row.type === old.type && row.path.split('/').slice(0, -1).join('/') === parent)
      .map((row) => ({ row, score: similarity(old.name, row.name) })).sort((a, b) => b.score - a.score)[0]
    if (possible?.score >= 0.65 && !activeKeys.has(old.object_key)) console.warn(`Possible rename detected (${Math.round(possible.score * 100)}% name similarity): ${old.path} -> ${possible.row.path}; manual metadata was not moved.`)
  }
  return merged
}

function similarity(left, right) {
  const a = left.normalize('NFC').toLocaleLowerCase('ru'); const b = right.normalize('NFC').toLocaleLowerCase('ru')
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]; previous[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length, 1)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  sync().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
