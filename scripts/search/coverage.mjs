import { dataDir, readTable, tagColumns } from './common.mjs'

export async function report() {
  const rows = await readTable(new URL('search-tags.csv', dataDir), tagColumns)
  const active = rows.filter(({ source_status }) => source_status === 'active')
  const folders = active.filter(({ type }) => type === 'folder')
  const files = active.filter(({ type }) => type === 'file')
  const hasAliases = active.filter(({ aliases }) => aliases.trim())
  const hasKeywords = active.filter(({ keywords }) => keywords.trim())
  const tagged = active.filter(({ aliases, keywords }) => aliases.trim() && keywords.trim())
  const missing = rows.filter(({ source_status }) => source_status === 'missing')
  const untaggedFolders = folders.filter(({ aliases, keywords }) => !aliases.trim() && !keywords.trim())
  const width = 25
  const lines = [
    'Search metadata coverage', '',
    `Objects:${' '.repeat(width - 8)}${active.length}`,
    `Folders:${' '.repeat(width - 8)}${folders.length}`,
    `Files:${' '.repeat(width - 8)}${files.length}`,
    `Objects with aliases:${' '.repeat(width - 21)}${hasAliases.length}`,
    `Objects with keywords:${' '.repeat(width - 22)}${hasKeywords.length}`,
    `Completely tagged:${' '.repeat(width - 18)}${tagged.length}`,
    `Without metadata:${' '.repeat(width - 17)}${active.length - active.filter(({ aliases, keywords }) => aliases.trim() || keywords.trim()).length}`,
    `Missing on source:${' '.repeat(width - 18)}${missing.length}`,
    '', 'Основные незаполненные папки:',
    ...(untaggedFolders.length ? untaggedFolders.slice(0, 25).map(({ course_title, path }) => `- ${course_title}: ${path}`) : ['- нет']),
    ...(untaggedFolders.length > 25 ? [`... и ещё ${untaggedFolders.length - 25}`] : []),
  ]
  console.log(lines.join('\n'))
  return { objects: active.length, folders: folders.length, files: files.length, aliases: hasAliases.length, keywords: hasKeywords.length, tagged: tagged.length, missing: missing.length }
}
if (process.argv[1]?.endsWith('/coverage.mjs')) report().catch((error) => { console.error(error.message); process.exitCode = 1 })
