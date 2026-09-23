import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCsv, stringifyCsv, objectKeyForPath, parseBoolean, readTable, tagColumns, synonymColumns, writeTable } from './common.mjs'
import { inventoryCourse, mergeInventory, sync } from './sync-yandex.mjs'
import { build, compileIndex } from './build.mjs'
import { validate } from './validate.mjs'
import { createQueue, queueColumns } from './tagging-queue.mjs'
import { applyTags, validateQueueAndApply } from './apply-tags.mjs'
import { summarize } from './coverage.mjs'

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
  assert.equal(result[0].inherit, 'TRUE')
  assert.equal(result[1].priority, '0'); assert.equal(result[1].enabled, 'TRUE'); assert.equal(result[1].keywords, '')
  assert.equal(result[1].inherit, 'FALSE')
  const absent = mergeInventory([{ ...old, source_status: 'missing' }], [])
  assert.equal(absent[0].source_status, 'missing'); assert.equal(absent[0].notes, 'review')
  assert.equal(absent[0].inherit, 'TRUE')
})

test('tagging queue selects folders at priority depths and sorts by course, depth, path', () => {
  const make = (course_id, path, type = 'folder', enabled = 'TRUE', source_status = 'active') => ({ object_key: `${course_id}:${path}`, course_id, course_title: course_id, type, path, name: path.split('/').at(-1), aliases: '', keywords: '', priority: '0', enabled, inherit: type === 'folder' ? 'TRUE' : 'FALSE', notes: '', source_status })
  const rows = [make('course-2', '2 course/2 Sem/Б'), make('course-1', '1 course/1 Sem/Z'), make('course-1', '1 course/1 Sem/A'), make('course-1', '1 course'), make('course-1', '1 course/1 Sem/A/file.pdf', 'file'), make('course-1', '1 course/1 Sem/Disabled', 'folder', 'FALSE')]
  const queue = createQueue(rows, { courseIds: ['course-1', 'course-2'] })
  assert.deepEqual(queue.map(({ path }) => path), ['1 course/1 Sem/A', '1 course/1 Sem/Z', '2 course/2 Sem/Б'])
  const allRows = createQueue(rows, { all: true, courseIds: ['course-1', 'course-2'] })
  assert.equal(allRows.length, 4)
  assert.equal(allRows.find(({ path }) => path === '1 course').status, 'root')
  assert(queue.every(({ status }) => status === 'priority'))
})

test('apply-tags joins on key, applies manual fields including enabled, and rejects machine edits atomically', () => {
  const canonical = [{ object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: '1 course/1 Семестр', name: '1 Семестр', aliases: '', keywords: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }]
  const [queueRow] = createQueue(canonical)
  const submitted = { ...queueRow, aliases: 'семестр; сем', priority: '10', enabled: 'FALSE', inherit: 'FALSE', notes: 'ok' }
  const { records, changes } = validateQueueAndApply(canonical, [submitted])
  assert.equal(changes.length, 1); assert.equal(records[0].enabled, 'FALSE'); assert.equal(records[0].aliases, 'семестр; сем')
  assert.throws(() => validateQueueAndApply(canonical, [{ ...submitted, path: 'edited' }]), /machine field path/)
  assert.throws(() => validateQueueAndApply(canonical, [{ ...submitted, status: 'later' }]), /status does not match/)
  assert.throws(() => validateQueueAndApply(canonical, [{ ...submitted, enabled: 'yes' }]), /TRUE or FALSE/)
  assert.throws(() => validateQueueAndApply(canonical, [{ ...submitted, object_key: 'unknown' }]), /Unknown object_key/)
  assert.throws(() => validateQueueAndApply(canonical, [submitted, submitted]), /duplicate object_key/)
})

test('apply-tags regenerates the queue after disabling a folder and preserves all-mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-apply-'))
  try {
    const tagsPath = join(dir, 'search-tags.csv'); const queuePath = join(dir, 'tagging-queue.csv')
    const make = (key, path) => ({ object_key: key, course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path, name: path.split('/').at(-1), aliases: '', keywords: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' })
    const canonical = [make('root', 'Курс'), make('target', 'Курс/1 Семестр'), make('sibling', 'Курс/1 Семестр/Математика'), make('later', 'Курс/1/2/3/4/5/Глубоко')]
    await writeTable(tagsPath, tagColumns, canonical)
    const priorityQueue = createQueue(canonical, { courseIds: ['course-1'] })
    await writeTable(queuePath, queueColumns, priorityQueue.map((row) => row.object_key === 'target' ? { ...row, enabled: 'FALSE' } : row))
    await applyTags({ tagsPath, queuePath })
    const queue = await readTable(queuePath, queueColumns)
    assert(!queue.some(({ object_key }) => object_key === 'target'))
    assert(queue.some(({ object_key }) => object_key === 'sibling'))
    assert(queue.every(({ status }) => status === 'priority'))
    const updated = await readTable(tagsPath, tagColumns)
    assert.equal(updated.find(({ object_key }) => object_key === 'target').enabled, 'FALSE')

    const allQueue = createQueue(canonical, { all: true, courseIds: ['course-1'] })
    await writeTable(tagsPath, tagColumns, canonical)
    await writeTable(queuePath, queueColumns, allQueue.map((row) => row.object_key === 'target' ? { ...row, enabled: 'FALSE' } : row))
    await applyTags({ tagsPath, queuePath })
    const refreshedAll = await readTable(queuePath, queueColumns)
    assert(!refreshedAll.some(({ object_key }) => object_key === 'target'))
    assert(refreshedAll.some(({ object_key }) => object_key === 'root'))
    assert(refreshedAll.some(({ object_key }) => object_key === 'later'))
  } finally { await rm(dir, { recursive: true, force: true }) }
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

test('failed course fetch does not overwrite the existing inventory snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-sync-failure-'))
  const input = join(dir, 'search-tags.csv')
  const legacyHeaders = tagColumns.filter((field) => field !== 'inherit')
  const before = stringifyCsv(legacyHeaders, [Object.fromEntries(legacyHeaders.map((field) => [field, field === 'object_key' ? 'old' : field === 'course_id' ? 'course-1' : '']))])
  try {
    await writeFile(input, before)
    await assert.rejects(sync({ input, fetcher: async () => ({ ok: false, status: 503 }) }), /HTTP 503/)
    assert.equal(await readFile(input, 'utf8'), before)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('validation catches duplicate keys, normalized tags, invalid priority, and boolean', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-meta-'))
  try {
    const row = { object_key: 'x', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Тест', name: 'Тест', aliases: 'матан; МАТАН', keywords: 'тема;;', priority: '1.2', enabled: 'да', inherit: 'TRUE', notes: '', source_status: 'active' }
    await writeTable(join(dir, 'search-tags.csv'), tagColumns, [row, { ...row, priority: '-1', inherit: 'yes' }])
    await writeTable(join(dir, 'search-synonyms.csv'), synonymColumns, [])
    const prior = console.error; const messages = []; console.error = (message) => messages.push(message)
    try { assert.equal(await validate(new URL(`file://${dir}/`)), false) } finally { console.error = prior }
    assert(messages.some((message) => message.includes('duplicate object_key')))
    assert(messages.some((message) => message.includes('duplicate items after normalization')))
    assert(messages.some((message) => message.includes('empty list item')))
    assert(messages.some((message) => message.includes('priority must be a non-negative integer')))
    assert(messages.some((message) => message.includes('enabled must be TRUE or FALSE')))
    assert(messages.some((message) => message.includes('inherit must be TRUE or FALSE')))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('generated index compiles tags and global synonyms and supports check mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-build-'))
  try {
    const tagsPath = join(dir, 'tags.csv'); const synonymsPath = join(dir, 'synonyms.csv'); const outputPath = join(dir, 'index.json')
    await writeTable(tagsPath, tagColumns, [{ object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Математика', name: 'Математика', aliases: 'матан; мат анализ', keywords: 'пределы; интегралы', priority: '20', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }])
    await writeTable(synonymsPath, synonymColumns, [{ term: 'Базы данных', synonyms: 'бд; субд', enabled: 'TRUE', notes: '' }])
    const index = await build({ tagsPath, synonymsPath, outputPath })
    assert.deepEqual(index.objects[0].aliases, ['матан', 'мат анализ'])
    assert.equal(index.objects[0].priority, 20); assert.equal(index.synonyms[0].term, 'базы данных')
    const firstBuild = await readFile(outputPath, 'utf8')
    await build({ tagsPath, synonymsPath, outputPath })
    assert.equal(await readFile(outputPath, 'utf8'), firstBuild)
    await build({ check: true, tagsPath, synonymsPath, outputPath })
    await writeFile(outputPath, '{}\n')
    await assert.rejects(build({ check: true, tagsPath, synonymsPath, outputPath }), /stale/)
    assert.match(await readFile(outputPath, 'utf8'), /\{\}/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('generated index has ordered same-course inherited refs and skips disabled sources without blocking ancestors', () => {
  const folder = (object_key, course_id, path, { enabled = 'TRUE', inherit = 'TRUE', aliases = '', keywords = '' } = {}) => ({ object_key, course_id, course_title: course_id, type: 'folder', path, name: path.split('/').at(-1), aliases, keywords, priority: '0', enabled, inherit, notes: '', source_status: 'active' })
  const rows = [
    folder('root1', 'course-1', '1 course', { aliases: 'курс' }),
    folder('sem1', 'course-1', '1 course/1 Семестр', { keywords: 'осень' }),
    folder('disabled', 'course-1', '1 course/1 Семестр/Скрыто', { enabled: 'FALSE', aliases: 'не наследовать' }),
    folder('leaf', 'course-1', '1 course/1 Семестр/Скрыто/Тема', { keywords: 'тема' }),
    { ...folder('file', 'course-1', '1 course/1 Семестр/Скрыто/Тема/лекция.pdf', { inherit: 'FALSE' }), type: 'file' },
    folder('other', 'course-2', '2 course/1 Семестр/Тема', { keywords: 'тема' }),
  ]
  const index = compileIndex(rows, [])
  const leaf = index.objects.find(({ objectKey }) => objectKey === 'leaf')
  assert.equal(leaf.inherit, true)
  assert.deepEqual(leaf.inherited, [{ distance: 2, objectKey: 'sem1' }, { distance: 3, objectKey: 'root1' }])
  assert(!index.objects.some(({ objectKey }) => objectKey === 'disabled'))
  assert.equal(index.objects.find(({ objectKey }) => objectKey === 'file').inherit, false)
  assert.deepEqual(index.objects.find(({ objectKey }) => objectKey === 'file').inherited, [
    { distance: 1, objectKey: 'leaf' }, { distance: 3, objectKey: 'sem1' }, { distance: 4, objectKey: 'root1' },
  ])
  assert.deepEqual(index.objects.find(({ objectKey }) => objectKey === 'other').inherited, [])
})

test('inherit FALSE prevents passing own tags and sibling tags do not cross over', () => {
  const folder = (object_key, path, options = {}) => ({ object_key, course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path, name: path.split('/').at(-1), aliases: options.aliases ?? '', keywords: options.keywords ?? '', priority: '0', enabled: 'TRUE', inherit: options.inherit ?? 'TRUE', notes: '', source_status: 'active' })
  const rows = [
    folder('root', 'Курс', { aliases: 'курс' }),
    folder('semester', 'Курс/Семестр', { keywords: 'осень' }),
    folder('stopper', 'Курс/Семестр/Ограничитель', { aliases: 'не передавать', inherit: 'FALSE' }),
    folder('grandchild', 'Курс/Семестр/Ограничитель/Тема', { keywords: 'тема' }),
    folder('sibling-a', 'Курс/Семестр/A', { aliases: 'а' }),
    folder('sibling-b', 'Курс/Семестр/B', { aliases: 'б' }),
  ]
  const index = compileIndex(rows, [])
  const refs = (key) => index.objects.find(({ objectKey }) => objectKey === key).inherited.map(({ objectKey }) => objectKey)
  assert.deepEqual(refs('grandchild'), ['semester', 'root'])
  assert.deepEqual(refs('sibling-a'), ['semester', 'root'])
  assert.deepEqual(refs('sibling-b'), ['semester', 'root'])
})

test('coverage counts tagged folders, local file tags, inherited refs, queue depth, and effective tags', () => {
  const folder = { object_key: 'root', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: '1 course', name: '1 course', aliases: 'курс', keywords: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }
  const file = { ...folder, object_key: 'file', type: 'file', path: '1 course/Лекция.pdf', name: 'Лекция.pdf', aliases: '', inherit: 'FALSE' }
  const missing = { ...folder, object_key: 'gone', path: '1 course/Removed', name: 'Removed', source_status: 'missing' }
  const result = summarize([folder, file, missing], [])
  assert.equal(result.active.length, 2)
  assert.equal(result.taggedFolders.length, 1)
  assert.equal(result.folderAliases.length, 1)
  assert.equal(result.folderKeywords.length, 0)
  assert.equal(result.taggedFiles, 0)
  assert.equal(result.inherited, 1)
  assert.equal(result.withoutEffectiveTags, 0)
  assert.equal(result.missing.length, 1)
  assert.deepEqual(result.depthCounts, [0, 0, 0])
})
