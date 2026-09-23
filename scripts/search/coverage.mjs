import { dataDir, parseBoolean, readTable, synonymColumns, tagColumns } from './common.mjs'
import { compileIndex } from './build.mjs'
import { createQueue } from './tagging-queue.mjs'

export function summarize(rows, synonymRows = []) {
  const active = rows.filter(({ source_status }) => source_status === 'active')
  const folders = active.filter(({ type }) => type === 'folder')
  const files = active.filter(({ type }) => type === 'file')
  const hasAliases = active.filter(({ aliases }) => aliases.trim())
  const hasKeywords = active.filter(({ keywords }) => keywords.trim())
  const tagged = active.filter(({ aliases, keywords }) => aliases.trim() && keywords.trim())
  const missing = rows.filter(({ source_status }) => source_status === 'missing')
  const untaggedFolders = folders.filter(({ aliases, keywords }) => !aliases.trim() && !keywords.trim())
  const enabled = active.filter(({ enabled: value }) => parseBoolean(value))
  const disabled = active.length - enabled.length
  const enabledFolders = enabled.filter(({ type }) => type === 'folder')
  const taggedFolders = enabledFolders.filter(({ aliases, keywords }) => aliases.trim() || keywords.trim())
  const folderAliases = enabledFolders.filter(({ aliases }) => aliases.trim())
  const folderKeywords = enabledFolders.filter(({ keywords }) => keywords.trim())
  const inheriting = enabledFolders.filter(({ inherit: value }) => parseBoolean(value)).length
  const taggedFiles = enabled.filter(({ type, aliases, keywords }) => type === 'file' && (aliases.trim() || keywords.trim())).length
  const queue = createQueue(rows)
  const index = compileIndex(rows, synonymRows)
  const inherited = index.objects.filter(({ inherited: refs }) => refs.length).length
  const byKey = new Map(index.objects.map((row) => [row.objectKey, row]))
  const withoutEffectiveTags = index.objects.filter((row) => !row.aliases.length && !row.keywords.length && !row.inherited.some(({ objectKey }) => {
    const source = byKey.get(objectKey)
    return source?.aliases.length || source?.keywords.length
  })).length
  const depthCounts = [1, 2, 3].map((depth) => queue.filter((row) => row.depth === depth).length)
  return { active, folders, files, hasAliases, hasKeywords, tagged, missing, untaggedFolders, enabled, disabled, taggedFolders, folderAliases, folderKeywords, inheriting, taggedFiles, queue, inherited, withoutEffectiveTags, depthCounts }
}

export async function report() {
  const rows = await readTable(new URL('search-tags.csv', dataDir), tagColumns)
  const synonymRows = await readTable(new URL('search-synonyms.csv', dataDir), synonymColumns)
  const { active, folders, files, hasAliases, hasKeywords, tagged, missing, untaggedFolders, enabled, disabled, taggedFolders, folderAliases, folderKeywords, inheriting, taggedFiles, queue, inherited, withoutEffectiveTags, depthCounts } = summarize(rows, synonymRows)
  const metric = (label, value) => `${label.padEnd(29)}${value}`
  const lines = [
    'Search metadata coverage', '',
    metric('Objects:', active.length), metric('Folders:', folders.length), metric('Files:', files.length),
    metric('Objects with aliases:', hasAliases.length), metric('Objects with keywords:', hasKeywords.length),
    metric('Completely tagged:', tagged.length),
    metric('Without metadata:', active.length - active.filter(({ aliases, keywords }) => aliases.trim() || keywords.trim()).length),
    metric('Tagged folders:', taggedFolders.length), metric('Folder aliases:', folderAliases.length),
    metric('Folder keywords:', folderKeywords.length), metric('Folder inherit TRUE:', inheriting),
    metric('Manually tagged files:', taggedFiles), metric('Enabled:', enabled.length), metric('Disabled:', disabled),
    metric('Objects with inherited tags:', inherited), metric('Without effective tags:', withoutEffectiveTags),
    metric('Missing on source:', missing.length),
    '', `Priority tagging queue: ${queue.length} folders (depth 1/2/3: ${depthCounts.join('/')})`,
    '', 'Основные незаполненные папки:',
    ...(untaggedFolders.length ? untaggedFolders.filter(({ enabled: value }) => parseBoolean(value)).slice(0, 25).map(({ course_title, path }) => `- ${course_title}: ${path}`) : ['- нет']),
    ...(untaggedFolders.filter(({ enabled: value }) => parseBoolean(value)).length > 25 ? [`... и ещё ${untaggedFolders.filter(({ enabled: value }) => parseBoolean(value)).length - 25}`] : []),
  ]
  console.log(lines.join('\n'))
  return { objects: active.length, folders: folders.length, files: files.length, aliases: hasAliases.length, keywords: hasKeywords.length, tagged: tagged.length, missing: missing.length, taggedFolders: taggedFolders.length, folderAliases: folderAliases.length, folderKeywords: folderKeywords.length, inheriting, taggedFiles, enabled: enabled.length, disabled, inherited, withoutEffectiveTags, queue: queue.length, depthCounts }
}
if (process.argv[1]?.endsWith('/coverage.mjs')) report().catch((error) => { console.error(error.message); process.exitCode = 1 })
