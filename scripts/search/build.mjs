import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { normalize, parseBoolean, readTable, splitList, synonymColumns, tagColumns } from './common.mjs'

const source = new URL('../../data/search/search-tags.csv', import.meta.url)
const synonymsSource = new URL('../../data/search/search-synonyms.csv', import.meta.url)
const destination = new URL('../../src/generated/search-index.json', import.meta.url)

export async function build({ check = false, tagsPath = source, synonymsPath = synonymsSource, outputPath = destination } = {}) {
  const rows = await readTable(tagsPath, tagColumns)
  const synonymRows = await readTable(synonymsPath, synonymColumns)
  const index = {
    _generated: 'DO NOT EDIT GENERATED SEARCH INDEX MANUALLY. Source of truth: data/search/search-tags.csv and search-synonyms.csv.',
    objects: rows.filter((row) => row.source_status === 'active').map((row) => ({
      objectKey: row.object_key, courseId: row.course_id, type: row.type, path: row.path, name: row.name,
      aliases: splitList(row.aliases), keywords: splitList(row.keywords), priority: Number(row.priority),
      enabled: parseBoolean(row.enabled), notes: row.notes,
    })),
    synonyms: synonymRows.filter((row) => parseBoolean(row.enabled)).map((row) => ({ term: normalize(row.term), synonyms: splitList(row.synonyms), notes: row.notes })),
  }
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
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) build({ check: process.argv.includes('--check') }).catch((error) => { console.error(error.message); process.exitCode = 1 })
