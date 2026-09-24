import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { parseCsv, stringifyCsv, objectKeyForPath, parseBoolean, readTable, tagColumns, legacyTagColumns, synonymColumns, writeTable } from './common.mjs'
import { inventoryCourse, mergeInventory, sync } from './sync-yandex.mjs'
import { build, compileIndex } from './build.mjs'
import { validate } from './validate.mjs'
import { createQueue, queueColumns } from './tagging-queue.mjs'
import { applyTags, validateQueueAndApply } from './apply-tags.mjs'
import { summarize } from './coverage.mjs'
import { buildPriorityTagRows, commitSourceFiles, generateWorkbook, mergeWorkbookSynonyms, overlayTagQueue, parseTagWorksheet, parseWorkbookSynonyms, readWorksheetRecords, sheetNames, tagSheetColumns } from './workbook.mjs'

test('generated Excel workbook contains the requested sheets, Unicode, hidden key and validations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-workbook-create-'))
  const path = join(dir, 'tagging-queue.xlsx')
  const inputTagsPath = join(dir, 'search-tags.csv')
  const inputSynonymsPath = join(dir, 'search-synonyms.csv')
  const inputQueuePath = join(dir, 'tagging-queue.csv')
  try {
    await writeFile(inputTagsPath, await readFile(new URL('../../data/search/search-tags.csv', import.meta.url)))
    await writeFile(inputSynonymsPath, await readFile(new URL('../../data/search/search-synonyms.csv', import.meta.url)))
    await writeFile(inputQueuePath, await readFile(new URL('../../data/search/tagging-queue.csv', import.meta.url)))
    const { tagRows } = await generateWorkbook({ path, noOpen: true, inputTagsPath, inputSynonymsPath, inputQueuePath })
    assert.equal(tagRows.length, 29)
    const queuedRows = await readTable(inputQueuePath, queueColumns)
    assert.equal(queuedRows.length, 29)
    for (const row of queuedRows) assert.equal(row.keywords.split(';').filter((term) => term.trim().toLocaleLowerCase('ru') === row.name.toLocaleLowerCase('ru')).length, 1)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path)
    assert.deepEqual(workbook.worksheets.map(({ name }) => name), ['Инструкция', 'Разметка', 'Синонимы'])
    const sheet = workbook.getWorksheet('Разметка')
    assert.deepEqual(sheet.getRow(1).values.slice(1, 4), ['Папка', 'Теги', 'Преподаватель'])
    assert.equal(sheet.rowCount, 30)
    const keyColumn = sheet.getRow(1).values.slice(1).indexOf('object_key') + 1
    assert.ok(keyColumn > 0)
    assert.equal(keyColumn, 4)
    assert.equal(sheet.getColumn(keyColumn).hidden, true)
    assert.match(sheet.getCell(2, 1).value, /^Курс 1 \/ 1 Семестр \/ Аналитическая геометрия$/)
    assert.equal(sheet.getCell(2, 2).value, tagRows[0].keywords)
    assert.match(sheet.getCell(2, 2).value, /Аналитическая геометрия/)
    assert.equal(sheet.getCell(2, 3).value, tagRows[0].teacher)
    assert.equal(sheet.views[0].ySplit, 1)
    assert.equal(sheet.getColumn(1).alignment.wrapText, true)
    const synonyms = workbook.getWorksheet('Синонимы')
    assert.equal(synonyms.getColumn(5).hidden, true)
    assert.equal(synonyms.getCell(3, 3).dataValidation.type, 'list')
    const firstKey = tagRows[0].object_key
    sheet.getCell(2, 2).value = 'ручная метка;'
    sheet.getCell(2, 3).value = 'Иванов;'
    await workbook.xlsx.writeFile(path)
    const regenerated = await generateWorkbook({ path, noOpen: true, inputTagsPath, inputSynonymsPath, inputQueuePath })
    const preserved = regenerated.tagRows.find(({ object_key }) => object_key === firstKey)
    assert.equal(preserved.keywords, 'ручная метка; Аналитическая геометрия')
    assert.equal(preserved.teacher, 'Иванов;')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('workbook row order is irrelevant and unknown or duplicate keys are rejected', () => {
  const queue = [
    { object_key: 'one', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Курс/А', name: 'А', depth: '1', status: 'priority', source_status: 'active', enabled: 'TRUE', aliases: '', keywords: '', priority: '0', inherit: 'TRUE', notes: '' },
    { object_key: 'two', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Курс/Б', name: 'Б', depth: '1', status: 'priority', source_status: 'active', enabled: 'TRUE', aliases: '', keywords: '', priority: '0', inherit: 'TRUE', notes: '' },
  ]
  const submitted = [...queue].reverse().map((row) => ({ ...row, teacher: `препод-${row.object_key};`, keywords: `tag-${row.object_key};` }))
  const parsed = parseTagWorksheet(submitted, queue)
  assert.deepEqual(parsed.map(({ object_key }) => object_key), ['one', 'two'])
  assert.deepEqual(parsed.map(({ keywords }) => keywords), ['tag-one; А', 'tag-two; Б'])
  assert.deepEqual(parsed.map(({ teacher }) => teacher), ['препод-one', 'препод-two'])
  assert.equal(parsed[0].inherit, 'TRUE')
  assert.equal(parsed[0].priority, '0')
  assert.throws(() => parseTagWorksheet([{ ...submitted[0], object_key: 'missing' }, submitted[1]], queue), /Unknown or ineligible object_key/)
  assert.throws(() => parseTagWorksheet([submitted[0], submitted[0]], queue), /Duplicate object_key/)
})

test('legacy workbook rows without teacher preserve expected teacher and import visible tags', () => {
  const queue = [{ object_key: 'legacy-key', name: 'Алгебра', keywords: 'Алгебра', teacher: 'Иванов', aliases: 'линал', priority: '0', enabled: 'TRUE', inherit: 'TRUE' }]
  const parsed = parseTagWorksheet([{ object_key: 'legacy-key', keywords: 'линал; Алгебра;' }], queue)
  assert.equal(parsed[0].keywords, 'линал; Алгебра')
  assert.equal(parsed[0].teacher, 'Иванов')
  const blankTeacher = parseTagWorksheet([{ object_key: 'legacy-key', keywords: 'Алгебра;' }], [{ ...queue[0], teacher: '' }])
  assert.equal(blankTeacher[0].teacher, '')
})

test('workbook source replacement restores earlier CSV when a later rename fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workbook-atomic-'))
  try {
    const tags = join(dir, 'tags.csv'); const synonyms = join(dir, 'synonyms.csv')
    await writeFile(tags, 'old tags'); await writeFile(synonyms, 'old synonyms')
    let calls = 0
    const renameFile = async (source, destination) => {
      calls++
      if (calls === 2) throw new Error('simulated second rename failure')
      await rename(source, destination)
    }
    await assert.rejects(commitSourceFiles([[tags, 'new tags'], [synonyms, 'new synonyms']], { renameFile }), /simulated second rename failure/)
    assert.equal(await readFile(tags, 'utf8'), 'old tags')
    assert.equal(await readFile(synonyms, 'utf8'), 'old synonyms')
    assert.equal((await readdir(dir)).some((name) => name.endsWith('.bak')), false)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('workbook source replacement preserves a recovery backup when rollback fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workbook-rollback-'))
  try {
    const tags = join(dir, 'tags.csv'); const synonyms = join(dir, 'synonyms.csv')
    await writeFile(tags, 'old tags'); await writeFile(synonyms, 'old synonyms')
    let calls = 0
    const renameFile = async (source, destination) => {
      calls++
      if (calls === 2 || calls === 3) throw new Error('simulated rename failure')
      await rename(source, destination)
    }
    await assert.rejects(commitSourceFiles([[tags, 'new tags'], [synonyms, 'new synonyms']], { renameFile }), /Recovery backups were preserved at:/)
    const backup = (await readdir(dir)).find((name) => name.endsWith('.bak'))
    assert.ok(backup)
    assert.equal(await readFile(join(dir, backup), 'utf8'), 'old tags')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('workbook overlays editable queue fields by stable key and keeps canonical fields', () => {
  const canonical = { object_key: 'k', course_id: 'course-1', path: 'Курс/Папка', name: 'Папка', aliases: '', keywords: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '' }
  const merged = overlayTagQueue([{ ...canonical, teacher: '' }], [{ ...canonical, path: 'spoof', aliases: 'папка', keywords: 'лекции', teacher: 'Профессор', priority: '7', enabled: 'FALSE', notes: 'ручное' }])
  assert.equal(merged[0].path, canonical.path)
  assert.equal(merged[0].aliases, '')
  assert.equal(merged[0].keywords, 'лекции')
  assert.equal(merged[0].teacher, 'Профессор')
  assert.equal(merged[0].priority, '0')
  assert.equal(merged[0].enabled, 'TRUE')
  assert.equal(merged[0].notes, '')
})

test('workbook synonym overlays retain edits, stable keys, new rows, and safe deletions', () => {
  const original = [{ object_key: 'synonym:old', term: 'базы данных', synonyms: 'бд', enabled: 'TRUE', notes: '' }]
  const prior = [
    { ...original[0], term: 'данные', synonyms: 'бд; субд', notes: 'общий' },
    { object_key: '', term: 'математический анализ', synonyms: 'матан', enabled: 'TRUE', notes: '' },
  ]
  const merged = mergeWorkbookSynonyms(original, prior)
  assert.equal(merged[0].term, 'данные')
  assert.equal(merged[0].object_key, 'synonym:old')
  assert.equal(merged[1].term, 'математический анализ')
  assert.equal(merged.length, 2)
  const applied = parseWorkbookSynonyms(merged, original)
  assert.equal(applied[0].object_key, 'synonym:old')
  assert.match(applied[1].object_key, /^synonym:/)
  assert.throws(() => parseWorkbookSynonyms([merged[0], { ...merged[0], term: 'другое' }, merged[1]], original), /Duplicate synonym object_key/)
  assert.throws(() => parseWorkbookSynonyms([{ ...merged[0], term: ' ' }], original), /clear synonyms and notes/)
  assert.throws(() => parseWorkbookSynonyms([{ ...merged[0], object_key: 'unknown' }], original), /Unknown synonym object_key/)
})

test('workbook rows map Russian headers and reject formulas', () => {
  const makeSheet = (firstValue) => ({
    name: sheetNames.tags, rowCount: 2,
    getRow: (rowNumber) => ({
      values: rowNumber === 1 ? [undefined, 'Папка', 'object_key'] : undefined,
      getCell: (column) => ({ value: rowNumber === 1 ? (column === 1 ? 'Папка' : 'object_key') : (column === 1 ? firstValue : 'stable') }),
    }),
  })
  const worksheet = makeSheet({ formula: '1+1' })
  assert.throws(() => readWorksheetRecords(worksheet, { Папка: 'folder_label' }), /formulas are not allowed/)
  assert.deepEqual(readWorksheetRecords(makeSheet('Курс / Папка'), { Папка: 'folder_label' }).records, [{ folder_label: 'Курс / Папка', object_key: 'stable' }])
  assert.equal(readWorksheetRecords(makeSheet('=SUM(A1:A2)'), { Папка: 'folder_label' }).records[0].folder_label, '=SUM(A1:A2)')
})

test('workbook has folder, tag and teacher fields; priority queue includes only depth two and each folder name once', () => {
  assert.deepEqual(tagSheetColumns.slice(0, 3).map(([, header]) => header), ['Папка', 'Теги', 'Преподаватель'])
  assert.equal(tagSheetColumns[3][0], 'object_key')
  const rows = Array.from({ length: 141 }, (_, index) => ({ object_key: `k${index}`, course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: `Курс/Семестр/${String(index).padStart(3, '0')}`, name: `${index}`, aliases: '', keywords: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }))
  const generated = buildPriorityTagRows(rows, ['course-1'], [{ ...rows[0], keywords: 'сохранено; 0;' }])
  assert.equal(generated.length, 141)
  assert.equal(generated[0].keywords, 'сохранено; 0')
  assert.equal(generated[1].keywords, '1')
  assert.equal(buildPriorityTagRows([{ ...rows[0], keywords: '0; 0;' }], ['course-1'])[0].keywords, '0')
})

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
  const old = { object_key: 'old', course_id: 'course-1', type: 'folder', path: 'Алгебра', name: 'Алгебра', aliases: 'линал', keywords: 'матрицы', teacher: 'Иванов', priority: '12', enabled: 'FALSE', notes: 'review', source_status: 'active' }
  const result = mergeInventory([old], [
    { object_key: 'old', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Алгебра', name: 'Алгебра' },
    { object_key: 'new', course_id: 'course-1', course_title: 'Курс 1', type: 'file', path: 'Алгебра/Лекция.pdf', name: 'Лекция.pdf' },
  ])
  assert.equal(result[0].aliases, 'линал'); assert.equal(result[0].enabled, 'FALSE')
  assert.equal(result[0].inherit, 'TRUE')
  assert.equal(result[0].teacher, 'Иванов')
  assert.equal(result[1].priority, '0'); assert.equal(result[1].enabled, 'TRUE'); assert.equal(result[1].keywords, '')
  assert.equal(result[1].teacher, '')
  assert.equal(result[1].inherit, 'FALSE')
  const absent = mergeInventory([{ ...old, source_status: 'missing' }], [])
  assert.equal(absent[0].source_status, 'missing'); assert.equal(absent[0].notes, 'review')
  assert.equal(absent[0].inherit, 'TRUE')
})

test('tagging queue selects folders directly inside semesters and sorts by course, depth, path', () => {
  const make = (course_id, path, type = 'folder', enabled = 'TRUE', source_status = 'active') => ({ object_key: `${course_id}:${path}`, course_id, course_title: course_id, type, path, name: path.split('/').at(-1), aliases: '', keywords: '', priority: '0', enabled, inherit: type === 'folder' ? 'TRUE' : 'FALSE', notes: '', source_status })
  const rows = [make('course-2', '2 course/2 Sem/Б'), make('course-1', '1 course/1 Sem/Z'), make('course-1', '1 course/1 Sem/A'), make('course-1', '1 course'), make('course-1', '1 course/1 Sem'), make('course-1', '1 course/1 Sem/A/Лекции'), make('course-1', '1 course/1 Sem/A/file.pdf', 'file'), make('course-1', '1 course/1 Sem/Disabled', 'folder', 'FALSE')]
  const queue = createQueue(rows, { courseIds: ['course-1', 'course-2'] })
  assert.deepEqual(queue.map(({ path }) => path), ['1 course/1 Sem/A', '1 course/1 Sem/Z', '2 course/2 Sem/Б'])
  assert(queue.every(({ depth, status }) => depth === 2 && status === 'priority'))
  const allRows = createQueue(rows, { all: true, courseIds: ['course-1', 'course-2'] })
  assert.equal(allRows.length, 6)
  assert.equal(allRows.find(({ path }) => path === '1 course').status, 'root')
  assert.equal(allRows.find(({ path }) => path === '1 course/1 Sem').status, 'later')
  assert.equal(allRows.find(({ path }) => path === '1 course/1 Sem/A/Лекции').status, 'later')
})

test('apply-tags joins on key, applies manual fields including enabled, and rejects machine edits atomically', () => {
  const canonical = [{ object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: '1 course/1 Семестр/Математика', name: 'Математика', aliases: '', keywords: '', teacher: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }]
  const [queueRow] = createQueue(canonical)
  const submitted = { ...queueRow, aliases: 'семестр; сем', keywords: 'матан', teacher: 'Иванов', priority: '10', enabled: 'FALSE', inherit: 'FALSE', notes: 'ok' }
  const { records, changes } = validateQueueAndApply(canonical, [submitted])
  assert.equal(changes.length, 1); assert.equal(records[0].enabled, 'FALSE'); assert.equal(records[0].aliases, 'семестр; сем')
  assert.equal(records[0].teacher, 'Иванов')
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
    assert.deepEqual(priorityQueue.map(({ object_key }) => object_key), ['sibling'])
    await writeTable(queuePath, queueColumns, priorityQueue.map((row) => ({ ...row, enabled: 'FALSE' })))
    await applyTags({ tagsPath, queuePath })
    const queue = await readTable(queuePath, queueColumns)
    assert.equal(queue.length, 0)
    assert(queue.every(({ status }) => status === 'priority'))
    const updated = await readTable(tagsPath, tagColumns)
    assert.equal(updated.find(({ object_key }) => object_key === 'sibling').enabled, 'FALSE')

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
  const legacyHeaders = legacyTagColumns[0]
  const before = stringifyCsv(legacyHeaders, [Object.fromEntries(legacyHeaders.map((field) => [field, field === 'object_key' ? 'old' : field === 'course_id' ? 'course-1' : '']))])
  try {
    await writeFile(input, before)
    await assert.rejects(sync({ input, fetcher: async () => ({ ok: false, status: 503 }) }), /HTTP 503/)
    assert.equal(await readFile(input, 'utf8'), before)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('legacy search-tags schemas without teacher remain readable with blank teacher defaults', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-legacy-teacher-'))
  try {
    const row = { object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Курс/Папка', name: 'Папка', aliases: '', keywords: 'ручной тег', teacher: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }
    for (const [index, headers] of legacyTagColumns.entries()) {
      const legacyPath = join(dir, `legacy-${index}.csv`)
      await writeTable(legacyPath, headers, [row])
      const migrated = await readTable(legacyPath, tagColumns)
      assert.equal(migrated[0].teacher, '')
      assert.equal(migrated[0].keywords, 'ручной тег')
      assert.equal(migrated[0].inherit, 'TRUE')
    }
    const oldNoInherit = join(dir, 'legacy-no-inherit.csv')
    const noInheritRow = { ...row }; delete noInheritRow.inherit
    await writeTable(oldNoInherit, legacyTagColumns[1], [noInheritRow])
    const migrated = await readTable(oldNoInherit, tagColumns)
    assert.equal(migrated[0].teacher, '')
    assert.equal(migrated[0].inherit, 'TRUE')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('validation catches duplicate keys, normalized tags, invalid priority, and boolean', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-meta-'))
  try {
    const row = { object_key: 'x', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Тест', name: 'Тест', aliases: 'матан; МАТАН', keywords: 'тема;;', teacher: 'Смирнов;;Иванов', priority: '1.2', enabled: 'да', inherit: 'TRUE', notes: '', source_status: 'active' }
    await writeTable(join(dir, 'search-tags.csv'), tagColumns, [row, { ...row, priority: '-1', inherit: 'yes' }])
    await writeTable(join(dir, 'search-synonyms.csv'), synonymColumns, [])
    const prior = console.error; const messages = []; console.error = (message) => messages.push(message)
    try { assert.equal(await validate(new URL(`file://${dir}/`)), false) } finally { console.error = prior }
    assert(messages.some((message) => message.includes('duplicate object_key')))
    assert(messages.some((message) => message.includes('duplicate items after normalization')))
    assert(messages.some((message) => message.includes('empty list item')))
    assert(messages.some((message) => message.includes('priority must be an integer from 0 to')))
    assert(messages.some((message) => message.includes('enabled must be TRUE or FALSE')))
    assert(messages.some((message) => message.includes('inherit must be TRUE or FALSE')))
    assert(messages.some((message) => message.includes('teacher: empty list item')))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('generated index compiles tags and global synonyms and supports check mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'search-build-'))
  try {
    const tagsPath = join(dir, 'tags.csv'); const synonymsPath = join(dir, 'synonyms.csv'); const outputPath = join(dir, 'index.json')
    await writeTable(tagsPath, tagColumns, [{ object_key: 'k', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Математика', name: 'Математика', aliases: 'матан; мат анализ', keywords: 'пределы; интегралы', teacher: 'Иванов; Петрова', priority: '20', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }])
    await writeTable(synonymsPath, synonymColumns, [{ term: 'Базы данных', synonyms: 'бд; субд', enabled: 'TRUE', notes: '' }])
    const index = await build({ tagsPath, synonymsPath, outputPath })
    assert.deepEqual(index.objects[0].aliases, ['матан', 'мат анализ'])
    assert.deepEqual(index.objects[0].teacher, ['Иванов', 'Петрова'])
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

test('teacher-only parent metadata is searchable by enabled descendants through inheritance', () => {
  const parent = { object_key: 'teacher-parent', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: 'Курс/Семестр/Предмет', name: 'Предмет', aliases: '', keywords: '', teacher: 'Иванов', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }
  const child = { ...parent, object_key: 'child', type: 'file', path: 'Курс/Семестр/Предмет/Лекция.pdf', name: 'Лекция.pdf', teacher: '', inherit: 'FALSE' }
  const index = compileIndex([parent, child], [])
  const object = index.objects.find(({ objectKey }) => objectKey === 'child')
  assert.deepEqual(object.inherited, [{ distance: 1, objectKey: 'teacher-parent' }])
  assert.deepEqual(index.objects.find(({ objectKey }) => objectKey === 'teacher-parent').teacher, ['Иванов'])
})

test('coverage counts tagged folders, local file tags, inherited refs, queue depth, and effective tags', () => {
  const folder = { object_key: 'root', course_id: 'course-1', course_title: 'Курс 1', type: 'folder', path: '1 course', name: '1 course', aliases: 'курс', keywords: '', teacher: '', priority: '0', enabled: 'TRUE', inherit: 'TRUE', notes: '', source_status: 'active' }
  const file = { ...folder, object_key: 'file', type: 'file', path: '1 course/Лекция.pdf', name: 'Лекция.pdf', aliases: '', teacher: 'Иванов', inherit: 'FALSE' }
  const missing = { ...folder, object_key: 'gone', path: '1 course/Removed', name: 'Removed', source_status: 'missing' }
  const result = summarize([folder, file, missing], [])
  assert.equal(result.active.length, 2)
  assert.equal(result.taggedFolders.length, 1)
  assert.equal(result.folderAliases.length, 1)
  assert.equal(result.folderKeywords.length, 0)
  assert.equal(result.taggedFiles, 1)
  assert.equal(result.hasTeachers.length, 1)
  assert.equal(result.inherited, 1)
  assert.equal(result.withoutEffectiveTags, 0)
  assert.equal(result.missing.length, 1)
  assert.deepEqual(result.depthCounts, [0, 0, 0])
})
