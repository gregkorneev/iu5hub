import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateQueueAndApply } from './apply-tags.mjs'
import { build } from './build.mjs'
import { dataDir, maxPriority, migrateSynonymTable, normalize, parseBoolean, readCourses, readSynonymTable, readTable, splitList, synonymColumns, tagColumns, writeTable } from './common.mjs'
import { report } from './coverage.mjs'
import { createQueue, legacyQueueColumns, queueColumns } from './tagging-queue.mjs'
import { validate } from './validate.mjs'

export const workbookPath = new URL('tagging-queue.xlsx', dataDir)
export const sheetNames = { tags: 'Разметка', synonyms: 'Синонимы', instructions: 'Инструкция' }
const queuePath = new URL('tagging-queue.csv', dataDir)
const tagsPath = new URL('search-tags.csv', dataDir)
const synonymsPath = new URL('search-synonyms.csv', dataDir)
const editableTagColumns = ['keywords', 'teacher']

export const tagSheetColumns = [
  ['folder_label', 'Папка', 84], ['keywords', 'Теги', 54], ['teacher', 'Преподаватель', 30],
  ['object_key', 'object_key', 28, true], ['course_id', 'course_id', 18, true], ['course_title', 'course_title', 18, true],
  ['type', 'type', 12, true], ['path', 'path', 58, true], ['name', 'name', 36, true], ['depth', 'depth', 10, true],
  ['status', 'status', 12, true], ['source_status', 'source_status', 16, true],
]
export const synonymSheetColumns = [
  ['term', 'Термин', 32], ['synonyms', 'Синонимы', 48], ['enabled', 'Включено', 12], ['notes', 'Заметка', 36],
  ['object_key', 'object_key', 28, true],
]
const normalFill = 'EAF3FF'
const headerFill = '24476B'
const localPath = (path) => path instanceof URL ? fileURLToPath(path) : resolve(path)
const tagHeaderMap = Object.fromEntries([
  ['Папка', 'folder_label'], ['Теги', 'keywords'], ['Преподаватель', 'teacher'],
  ['object_key', 'object_key'], ['course_id', 'course_id'], ['course_title', 'course_title'], ['type', 'type'],
  ['path', 'path'], ['name', 'name'], ['depth', 'depth'], ['status', 'status'], ['source_status', 'source_status'],
].map(([header, field]) => [header, field]))
const synonymHeaderMap = Object.fromEntries([['Термин', 'term'], ['Синонимы', 'synonyms'], ['Включено', 'enabled'], ['Заметка', 'notes'], ['object_key', 'object_key']])

export function overlayTagQueue(baseRows, overlays) {
  const prior = new Map(overlays.filter((row) => row.object_key).map((row) => [row.object_key, row]))
  return baseRows.map((row) => {
    const old = prior.get(row.object_key)
    return old ? { ...row, ...Object.fromEntries(editableTagColumns.map((field) => [field, old[field] ?? row[field]])) } : row
  })
}

export function buildPriorityTagRows(tags, courseIds, queueOverlay = [], workbookOverlay = []) {
  const selected = createQueue(tags, { courseIds })
  return overlayTagQueue(overlayTagQueue(selected, queueOverlay), workbookOverlay).map((row) => ({
    ...row,
    keywords: ensureNameOnce(row.keywords, row.name),
    teacher: row.teacher ?? '',
  }))
}

async function readQueueOverlay(path) {
  try { await access(localPath(path)) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  try { return await readTable(path, queueColumns) } catch (error) {
    try { return (await readTable(path, legacyQueueColumns)).map((row) => ({ ...row, teacher: '' })) } catch { throw error }
  }
}

function ensureNameOnce(value, name) {
  const terms = splitList(value ?? '')
  const normalizedName = normalize(name)
  const firstNameIndex = terms.findIndex((term) => normalize(term) === normalizedName)
  const withoutDuplicateName = terms.filter((term, index) => normalize(term) !== normalizedName || index === firstNameIndex)
  if (firstNameIndex < 0) withoutDuplicateName.push(name)
  return withoutDuplicateName.join('; ')
}

function normalizeWorkbookList(value) {
  return splitList(value ?? '').join('; ')
}

export function mergeWorkbookSynonyms(sourceRows, priorRows) {
  const source = new Map(sourceRows.map((row) => [row.object_key, { ...row }]))
  const merged = sourceRows.map((row) => {
    const old = priorRows.find((candidate) => candidate.object_key ? candidate.object_key === row.object_key : normalize(candidate.term ?? '') === normalize(row.term))
    return old ? { ...row, ...Object.fromEntries(['term', 'synonyms', 'enabled', 'notes'].map((field) => [field, old[field] ?? row[field]])) } : row
  })
  const known = new Set(source.keys())
  for (const row of priorRows) {
    if (row.object_key && known.has(row.object_key)) continue
    if (!row.object_key && row.term?.trim() && !sourceRows.some((sourceRow) => normalize(sourceRow.term) === normalize(row.term))) merged.push({ term: row.term, synonyms: row.synonyms ?? '', enabled: row.enabled ?? 'TRUE', notes: row.notes ?? '', object_key: '' })
  }
  return merged
}

function displayValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '')
    if (Array.isArray(value.richText)) return value.richText.map(({ text }) => text).join('')
    if ('result' in value) return String(value.result ?? '')
    if ('hyperlink' in value && 'text' in value) return String(value.text)
  }
  return String(value)
}

export function readWorksheetRecords(worksheet, headerMap = {}) {
  if (!worksheet || worksheet.rowCount < 1) throw new Error('Workbook is missing a required worksheet')
  const displayHeaders = worksheet.getRow(1).values.slice(1).map(displayValue)
  const headers = displayHeaders.map((header) => headerMap[header] ?? header)
  if (new Set(headers).size !== headers.length) throw new Error(`Duplicate columns in worksheet ${worksheet.name}`)
  const records = []
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex)
    for (let column = 1; column <= headers.length; column++) if (row.getCell(column).value && typeof row.getCell(column).value === 'object' && ['formula', 'sharedFormula', 'arrayFormula'].some((field) => field in row.getCell(column).value)) {
      throw new Error(`${worksheet.name} row ${rowIndex}: formulas are not allowed in workbook data`)
    }
    const record = Object.fromEntries(headers.map((header, index) => [header, displayValue(row.getCell(index + 1).value)]))
    if (Object.values(record).some((value) => value.trim() !== '')) records.push(record)
  }
  return { headers, records }
}

const makeWorkbook = async (tagRows, synonymRows) => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Студент ИУ5'
  workbook.subject = 'Ручная настройка метаданных интеллектуального поиска'
  workbook.title = 'Таблица тегов поиска'

  const instructions = workbook.addWorksheet(sheetNames.instructions, { views: [{ showGridLines: false }] })
  instructions.columns = [{ width: 100 }]
  instructions.addRows([
    ['Настройка поиска «Студент ИУ5»'],
    [''],
    ['Лист «Разметка»'],
    ['В листе список папок, поле «Теги» и поле «Преподаватель». Заполняйте две синие колонки.'],
    ['«Теги» ищут название папки и её темы или важные слова. Имя папки уже добавлено автоматически; можно дописать альтернативные названия и темы.'],
    ['«Преподаватель» — отдельные имена преподавателей для поиска. Несколько значений разделяйте точкой с запятой.'],
    ['Теги папки автоматически учитываются для её содержимого. Позже их можно будет отдельно разнести по категориям.'],
    ['Служебные настройки сохраняются в исходной таблице и здесь не редактируются.'],
    ['Не меняйте скрытый object_key: он нужен для сопоставления папки после сортировки строк.'],
    [''],
    ['Лист «Синонимы»'],
    ['Добавляйте одну общую поисковую тему на строку. Синонимы разделяйте точкой с запятой. Можно менять термин, синонимы, включение и заметку. Не меняйте скрытый object_key.'],
    [''],
    ['Рабочий цикл'],
    ['1. npm run search:workbook — обновить таблицу; незаписанные изменения книги сохраняются по object_key. На macOS команда откроет Excel.'],
    ['2. Заполнить таблицы, сохранить книгу.'],
    ['3. npm run search:workbook:apply — проверить книгу и перенести изменения в CSV. Команда проверит данные, соберёт индекс и покажет coverage.'],
    ['CSV остаётся источником истины. Не отправляйте XLSX вместо search-tags.csv и search-synonyms.csv.'],
  ])
  instructions.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF24476B' } }
  for (const cell of ['A3', 'A11', 'A14']) instructions.getCell(cell).font = { bold: true, size: 12 }
  for (let row = 1; row <= 18; row++) instructions.getRow(row).height = row === 1 ? 26 : 24
  instructions.getColumn(1).alignment = { wrapText: true, vertical: 'middle' }

  addTableSheet(workbook, sheetNames.tags, tagSheetColumns, tagRows)
  addTableSheet(workbook, sheetNames.synonyms, synonymSheetColumns, synonymRows)
  return workbook
}

function addTableSheet(workbook, sheetName, columns, rows) {
  const worksheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
  worksheet.columns = columns.map(([key, header, width, hidden]) => ({ key, header, width, hidden: Boolean(hidden) }))
  for (const row of rows) worksheet.addRow(Object.fromEntries(columns.map(([key]) => [key, key === 'folder_label' ? folderLabel(row) : row[key] ?? ''])))
  const end = worksheet.getRow(1).cellCount
  const last = worksheet.getRow(Math.max(1, worksheet.rowCount)).getCell(end).address
  worksheet.autoFilter = { from: 'A1', to: last }
  const header = worksheet.getRow(1)
  header.height = 30
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerFill}` } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  columns.forEach(([key, , , hidden], index) => {
    const column = worksheet.getColumn(index + 1)
    column.hidden = Boolean(hidden)
    if (['folder_label', 'aliases', 'keywords', 'notes'].includes(key)) {
      column.alignment = { vertical: 'top', wrapText: true }
    }
    if (editableTagColumns.includes(key) || (sheetName === sheetNames.synonyms && ['term', 'synonyms', 'enabled', 'notes'].includes(key))) {
      for (let row = 2; row <= worksheet.rowCount; row++) worksheet.getCell(row, index + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${normalFill}` } }
    }
    if (['enabled', 'inherit'].includes(key)) for (let row = 2; row <= Math.max(2, worksheet.rowCount); row++) {
      worksheet.getCell(row, index + 1).dataValidation = { type: 'list', allowBlank: false, formulae: ['"TRUE,FALSE"'] }
    }
    if (key === 'priority') {
      column.numFmt = '0'
      for (let row = 2; row <= worksheet.rowCount; row++) worksheet.getCell(row, index + 1).dataValidation = { type: 'whole', operator: 'between', allowBlank: false, formulae: [0, maxPriority] }
    }
  })
  if (sheetName === sheetNames.synonyms) {
    const endRow = 500
    for (const key of ['enabled']) {
      const column = worksheet.getCell(1, columns.findIndex(([field]) => field === key) + 1).address.replace(/\d+$/, '')
      const startRow = Math.max(3, worksheet.rowCount + 1)
      if (startRow <= endRow) worksheet.dataValidations.add(`${column}${startRow}:${column}${endRow}`, { type: 'list', allowBlank: false, formulae: ['"TRUE,FALSE"'] })
    }
  }
  worksheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.height = 24 })
  worksheet.name = sheetName
  worksheet.state = 'visible'
  worksheet.properties.defaultRowHeight = 18
  worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  worksheet.properties.outlineLevelRow = 0
}

function folderLabel(row) {
  const parts = row.path.split('/').filter(Boolean)
  return [row.course_title, ...parts.slice(1)].join(' / ')
}

function requireHiddenColumn(worksheet, header) {
  const headers = worksheet.getRow(1).values.slice(1).map(displayValue)
  const columnIndex = headers.indexOf(header)
  if (columnIndex < 0 || worksheet.getColumn(columnIndex + 1).hidden !== true) throw new Error(`${worksheet.name}: ${header} column must remain hidden`)
}

export function parseTagWorksheet(records, expectedQueue) {
  const required = ['object_key', 'keywords']
  const headers = Object.keys(records[0] ?? {})
  if (required.some((header) => !headers.includes(header))) throw new Error(`Разметка sheet must include fields ${required.join(', ')}`)
  const canonicalQueue = new Map(expectedQueue.map((row) => [row.object_key, row]))
  const submittedByKey = new Map()
  for (const row of records) {
    if (!row.object_key) throw new Error('Every Разметка row must retain its hidden object_key')
    const expected = canonicalQueue.get(row.object_key)
    if (!expected) throw new Error(`Unknown or ineligible object_key in workbook: ${row.object_key}`)
    if (submittedByKey.has(row.object_key)) throw new Error(`Duplicate object_key in Разметка sheet: ${row.object_key}`)
    submittedByKey.set(row.object_key, {
      ...expected,
      keywords: ensureNameOnce(normalizeWorkbookList(row.keywords), expected.name),
      teacher: row.teacher === undefined ? (expected.teacher ?? '') : normalizeWorkbookList(row.teacher),
    })
  }
  if (submittedByKey.size !== expectedQueue.length) {
    throw new Error('Разметка sheet must contain each current tagging queue object exactly once')
  }
  return expectedQueue.map(({ object_key }) => submittedByKey.get(object_key))
}

export function parseWorkbookSynonyms(records, canonicalRows) {
  const byKey = new Map(canonicalRows.map((row) => [row.object_key, row]))
  const seen = new Set()
  const result = []
  for (const source of records) {
    const row = { term: source.term.trim(), synonyms: source.synonyms.trim(), enabled: source.enabled.trim() ? source.enabled.trim().toUpperCase() : 'TRUE', notes: source.notes, object_key: source.object_key.trim() }
    if (!row.object_key && !row.term && !row.synonyms && !row.notes) continue
    if (!row.object_key) {
      if (!row.term) throw new Error('New synonym row requires a term')
      row.object_key = `synonym:${randomUUID()}`
    } else if (!byKey.has(row.object_key)) throw new Error(`Unknown synonym object_key: ${row.object_key}`)
    if (seen.has(row.object_key)) throw new Error(`Duplicate synonym object_key: ${row.object_key}`)
    seen.add(row.object_key)
    if (!row.term) {
      if (row.synonyms || row.notes) throw new Error(`${row.object_key}: clear synonyms and notes to delete a synonym row`)
      continue
    }
    parseBoolean(row.enabled)
    result.push(row)
  }
  const terms = new Set()
  for (const row of result) {
    const term = normalize(row.term)
    if (terms.has(term)) throw new Error(`Duplicate synonym term: ${row.term}`)
    terms.add(term)
  }
  for (const row of canonicalRows) if (!seen.has(row.object_key)) throw new Error(`Synonym row ${row.object_key} was removed; clear its term to delete it safely`)
  return result
}

async function readPriorWorkbook(path) {
  try { await access(localPath(path)) } catch { return { tags: [], synonyms: [] } }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(localPath(path))
  const tagsSheet = workbook.getWorksheet(sheetNames.tags)
  const synonymsSheet = workbook.getWorksheet(sheetNames.synonyms)
  if (!tagsSheet || !synonymsSheet) throw new Error('Existing workbook must contain Разметка and Синонимы sheets')
  return {
    tags: readWorksheetRecords(tagsSheet, tagHeaderMap).records,
    synonyms: readWorksheetRecords(synonymsSheet, synonymHeaderMap).records,
  }
}

export async function generateWorkbook({ path = workbookPath, noOpen = false, inputTagsPath = tagsPath, inputSynonymsPath = synonymsPath, inputQueuePath = queuePath } = {}) {
  const tags = await readTable(inputTagsPath, tagColumns)
  const synonyms = await migrateSynonymTable(inputSynonymsPath)
  const prior = await readPriorWorkbook(path)
  const previousQueueCsv = await readQueueOverlay(inputQueuePath)
  const courses = await readCourses()
  const tagRows = buildPriorityTagRows(tags, courses.map(({ id }) => id), previousQueueCsv, prior.tags)
  const synonymRows = mergeWorkbookSynonyms(synonyms, prior.synonyms)
  await writeTable(inputQueuePath, queueColumns, tagRows)
  const xlsx = await makeWorkbook(tagRows, synonymRows)
  await mkdir(dirname(localPath(path)), { recursive: true })
  await xlsx.xlsx.writeFile(localPath(path))
  if (!noOpen && process.platform === 'darwin') {
    const { execFileSync } = await import('node:child_process')
    try { execFileSync('open', ['-a', 'Microsoft Excel', resolve(localPath(path))], { stdio: 'ignore' }) }
    catch { console.warn('Microsoft Excel could not be opened automatically; the workbook is ready at the path above.') }
  }
  console.log(`Workbook ready: ${resolve(localPath(path))} (${tagRows.length} folder rows, ${synonymRows.length} synonym rows).`)
  return { tagRows, synonymRows }
}

export async function commitSourceFiles(files, { renameFile = rename } = {}) {
  const temps = files.map(([path]) => `${path}.${randomUUID()}.tmp`)
  const backups = files.map(([path]) => `${path}.${randomUUID()}.bak`)
  const preserveBackups = new Set()
  let renamed = 0
  try {
    for (let index = 0; index < files.length; index++) await writeFile(temps[index], files[index][1], 'utf8')
    for (let index = 0; index < files.length; index++) await copyFile(files[index][0], backups[index])
    for (let index = 0; index < files.length; index++) { await renameFile(temps[index], files[index][0]); renamed++ }
  } catch (error) {
    const rollbackErrors = []
    for (let index = renamed - 1; index >= 0; index--) {
      try { await renameFile(backups[index], files[index][0]) }
      catch (rollbackError) {
        preserveBackups.add(backups[index])
        rollbackErrors.push(`${backups[index]} (${rollbackError.message})`)
      }
    }
    if (rollbackErrors.length) throw new AggregateError([error], `Could not fully restore CSV source files. Recovery backups were preserved at: ${rollbackErrors.join('; ')}`)
    throw error
  } finally {
    await Promise.all([...temps, ...backups.filter((path) => !preserveBackups.has(path))].map((path) => rm(path, { force: true })))
  }
}

export async function applyWorkbook({ path = workbookPath } = {}) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(localPath(path))
  const tagsSheet = workbook.getWorksheet(sheetNames.tags)
  const synonymsSheet = workbook.getWorksheet(sheetNames.synonyms)
  if (!tagsSheet || !synonymsSheet) throw new Error('Workbook must contain Разметка and Синонимы sheets')
  requireHiddenColumn(tagsSheet, 'object_key')
  requireHiddenColumn(synonymsSheet, 'object_key')
  const canonical = await readTable(tagsPath, tagColumns)
  const synonyms = await readSynonymTable(synonymsPath)
  const courses = await readCourses()
  const tagSheet = readWorksheetRecords(tagsSheet, tagHeaderMap)
  const queue = createQueue(canonical, { courseIds: courses.map(({ id }) => id) })
  const sheetTags = parseTagWorksheet(tagSheet.records, queue)
  const appliedTags = validateQueueAndApply(canonical, sheetTags)
  const synonymSheet = readWorksheetRecords(synonymsSheet, synonymHeaderMap)
  if (synonymColumns.some((field) => !synonymSheet.headers.includes(field))) throw new Error(`Синонимы sheet must include fields ${synonymColumns.join(', ')}`)
  const sheetSynonyms = parseWorkbookSynonyms(synonymSheet.records, synonyms)
  const tempDir = await mkdtemp(join((await import('node:os')).tmpdir(), 'iu5hub-search-workbook-'))
  try {
    const stagedTags = resolve(tempDir, 'search-tags.csv')
    const stagedSynonyms = resolve(tempDir, 'search-synonyms.csv')
    await writeTable(stagedTags, tagColumns, appliedTags.records)
    await writeTable(stagedSynonyms, synonymColumns, sheetSynonyms)
    if (!(await validate(new URL(`file://${tempDir}/`)))) throw new Error('Workbook changes did not pass search:validate')
    await commitSourceFiles([[fileURLToPath(tagsPath), await readFile(stagedTags, 'utf8')], [fileURLToPath(synonymsPath), await readFile(stagedSynonyms, 'utf8')]])
  } finally { await rm(tempDir, { recursive: true, force: true }) }
  const nextQueue = createQueue(appliedTags.records, { courseIds: courses.map(({ id }) => id) })
  await writeTable(queuePath, queueColumns, nextQueue)
  await validate()
  await build()
  await report()
  await generateWorkbook({ path, noOpen: true })
  console.log(`Applied workbook metadata: ${appliedTags.changes.length} folders, ${sheetSynonyms.length} synonym entries.`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const apply = process.argv.includes('--apply')
  const noOpen = process.argv.includes('--no-open')
  const run = apply ? applyWorkbook({ path: workbookPath }) : generateWorkbook({ path: workbookPath, noOpen })
  run.catch((error) => { console.error(error.message); process.exitCode = 1 })
}
