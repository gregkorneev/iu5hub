import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCsv, stringifyCsv, objectKeyForPath, parseBoolean, tagColumns, synonymColumns, writeTable } from './common.mjs'
import { inventoryCourse, mergeInventory } from './sync-yandex.mjs'
import { build } from './build.mjs'
import { validate } from './validate.mjs'

test('CSV handles Cyrillic, quoting, commas, and line endings', () => {
  const source = '\ufeffname,notes\r\n"Математический анализ","строка, с ""кавычками"""\r\n'
  const parsed = parseCsv(source)
  assert.equal(parsed.records[0].name, 'Математический анализ')
  assert.equal(parsed.records[0].notes, 'строка, с "кавычками"')
  assert.deepEqual(parseCsv(stringifyCsv(parsed.headers, parsed.records)), parsed)
  assert.throws(() => parseCsv('a,b\n1'), /expected 2/)
})

test('semicolon lists, booleans, and path key strategy are deterministic', () => {
  assert.deepEqual(['матан; мат анализ'].join('').split(';').map((value) => value.trim()), ['матан', 'мат анализ'])
  assert.equal(parseBoolean('TRUE'), true)
  assert.equal(parseBoolean('false'), false)
  assert.throws(() => parseBoolean('да'))
  assert.equal(objectKeyForPath('course-2', 'Семестр/БД'), objectKeyForPath('course-2', 'Семестр/БД'))
  assert.notEqual(objectKeyForPath('course-2', 'Семестр/БД'), objectKeyForPath('course-2', 'Семестр/ДБ'))
})

test('sync merge preserves manual metadata, adds new rows, and retains missing rows', () => {
  const old = { object_key: 'old', course_id: 'course-1', type: 'folder', path: 'Алгебра', name: 'Алгебра', aliases: 'линал', keywords: 'матрицы', priority: '12', enabled: 'FALSE', notes: 'review', source_status: 'active' }
  const result = mergeInventory([old], [
    { object_key: 'old', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Алгебра', name: 'Алгебра' },
    { object_key: 'new', course_id: 'course-1', course_title: 'Курс 1', type: 'file', path: 'Алгебра/Лекция.pdf', name: 'Лекция.pdf' },
  ])
  assert.equal(result[0].aliases, 'линал'); assert.equal(result[0].enabled, 'FALSE')
  assert.equal(result[1].priority, '0'); assert.equal(result[1].enabled, 'TRUE'); assert.equal(result[1].keywords, '')
  const absent = mergeInventory([old], [])
  assert.equal(absent[0].source_status, 'missing'); assert.equal(absent[0].notes, 'review')
})

test('Yandex inventory recursively lists folders and uses pagination without network', async () => {
  const calls = []
  const fetcher = async (url) => {
    const parsed = new URL(url); const path = parsed.searchParams.get('path') ?? ''; const offset = Number(parsed.searchParams.get('offset') ?? 0)
    calls.push([path, offset])
    let payload
    if (!path && !offset) payload = { name: 'Курс 1', type: 'dir', _embedded: { items: [{ name: 'Папка', path: '/Папка', type: 'dir' }, ...Array.from({ length: 999 }, (_, i) => ({ name: `Файл ${i}.pdf`, path: `/Файл ${i}.pdf`, type: 'file' }))] } }
    else if (!path && offset) payload = { _embedded: { items: [{ name: 'Поздний.pdf', path: '/Поздний.pdf', type: 'file' }] } }
    else if (path === '/Папка') payload = { _embedded: { items: [{ name: 'Вложенная', path: '/Папка/Вложенная', type: 'dir' }] } }
    else payload = { _embedded: { items: [{ name: 'Семинар.pdf', path: '/Папка/Вложенная/Семинар.pdf', type: 'file' }] } }
    return { ok: true, json: async () => payload }
  }
  const objects = await inventoryCourse({ id: 'course-1', title: 'Курс 1', publicUrl: 'https://disk.yandex.ru/d/example' }, fetcher)
  assert(objects.some(({ path, type }) => path === 'Курс 1' && type === 'folder'))
  assert(objects.some(({ path }) => path === 'Курс 1/Папка/Вложенная/Семинар.pdf'))
  assert(calls.some(([, offset]) => offset === 1000))
})

test('validation catches duplicate keys, normalized tags, invalid priority, and boolean', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-meta-'))
  try {
    const row = { object_key: 'x', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Тест', name: 'Тест', aliases: 'матан; МАТАН', keywords: 'тема;;', priority: '1.2', enabled: 'да', notes: '', source_status: 'active' }
    await writeTable(join(dir, 'search-tags.csv'), tagColumns, [row, { ...row, priority: '-1' }])
    await writeTable(join(dir, 'search-synonyms.csv'), synonymColumns, [])
    const prior = console.error; const messages = []; console.error = (message) => messages.push(message)
    try { assert.equal(await validate(new URL(`file://${dir}/`)), false) } finally { console.error = prior }
    assert(messages.some((message) => message.includes('duplicate object_key')))
    assert(messages.some((message) => message.includes('duplicate items after normalization')))
    assert(messages.some((message) => message.includes('empty list item')))
    assert(messages.some((message) => message.includes('priority must be a non-negative integer')))
    assert(messages.some((message) => message.includes('enabled must be TRUE or FALSE')))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('generated index compiles tags and global synonyms and supports check mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-build-'))
  try {
    const tagsPath = join(dir, 'tags.csv'); const synonymsPath = join(dir, 'synonyms.csv'); const outputPath = join(dir, 'index.json')
    await writeTable(tagsPath, tagColumns, [{ object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Математика', name: 'Математика', aliases: 'матан; мат анализ', keywords: 'пределы; интегралы', priority: '20', enabled: 'TRUE', notes: '', source_status: 'active' }])
    await writeTable(synonymsPath, synonymColumns, [{ term: 'Базы данных', synonyms: 'бд; субд', enabled: 'TRUE', notes: '' }])
    const index = await build({ tagsPath, synonymsPath, outputPath })
    assert.deepEqual(index.objects[0].aliases, ['матан', 'мат анализ'])
    assert.equal(index.objects[0].priority, 20); assert.equal(index.synonyms[0].term, 'базы данных')
    await build({ check: true, tagsPath, synonymsPath, outputPath })
    await writeFile(outputPath, '{}\n')
    await assert.rejects(build({ check: true, tagsPath, synonymsPath, outputPath }), /stale/)
    assert.match(await readFile(outputPath, 'utf8'), /\{\}/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
