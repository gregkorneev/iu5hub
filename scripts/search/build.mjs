import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { normalize, parseBoolean, readSynonymTable, readTable, splitList, tagColumns } from './common.mjs'

const source = new URL('../../data/search/search-tags.csv', import.meta.url)
const synonymsSource = new URL('../../data/search/search-synonyms.csv', import.meta.url)
const destination = new URL('../../src/generated/search-index.json', import.meta.url)

export async function build({ check = false, tagsPath = source, synonymsPath = synonymsSource, outputPath = destination } = {}) {
  const rows = await readTable(tagsPath, tagColumns)
  const synonymRows = await readSynonymTable(synonymsPath)
  const index = compileIndex(rows, synonymRows)
  const result = `${JSON.stringify(index, null, 2)}\n`
  if (check) {
    let current
    try { current = await readFile(outputPath, 'utf8') } catch { current = '' }
    if (current !== result) throw new Error('Generated search index is stale; run npm run search:build')
    console.log('Generated search index is up to date.')
  } else {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(new URL('../../src/generated/', import.meta.url), { recursive: true })
    await writeFile(outputPath, result, 'utf8')
    console.log(`Generated ${index.objects.length} search objects and ${index.synonyms.length} synonym entries.`)
  }
  return index
}

export function compileIndex(rows, synonymRows) {
  const active = rows.filter((row) => row.source_status === 'active' && parseBoolean(row.enabled))
  const byPath = new Map(active.filter((row) => row.type === 'folder').map((row) => [`${row.course_id}\0${row.path}`, row]))
  const objects = active.map((row) => {
    const segments = row.path.split('/').filter(Boolean)
    const inherited = []
    for (let length = segments.length - 1; length > 0; length--) {
      const ancestor = byPath.get(`${row.course_id}\0${segments.slice(0, length).join('/')}`)
      if (ancestor && parseBoolean(ancestor.enabled) && parseBoolean(ancestor.inherit) && (ancestor.aliases.trim() || ancestor.keywords.trim() || (ancestor.teacher ?? '').trim())) {
        inherited.push({ distance: segments.length - length, objectKey: ancestor.object_key })
      }
    }
    return {
      objectKey: row.object_key, courseId: row.course_id, type: row.type, path: row.path, name: row.name,
      aliases: splitList(row.aliases), keywords: splitList(row.keywords),
      ...(row.teacher?.trim() ? { teacher: splitList(row.teacher) } : {}), priority: Number(row.priority),
      enabled: true, inherit: parseBoolean(row.inherit), inherited,
    }
  })
  const index = {
    _generated: 'DO NOT EDIT GENERATED SEARCH INDEX MANUALLY. Source of truth: data/search/search-tags.csv and search-synonyms.csv.',
    objects,
    synonyms: synonymRows.filter((row) => parseBoolean(row.enabled)).map((row) => ({ term: normalize(row.term), synonyms: splitList(row.synonyms), notes: row.notes })),
  }
  return index
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) build({ check: process.argv.includes('--check') }).catch((error) => { console.error(error.message); process.exitCode = 1 })
