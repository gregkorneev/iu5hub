import folderIndex from '../generated/search-folder-index.json'

export interface TaggedFolder { objectKey: string; courseId: string; path: string; name: string; tags: string[]; teachers: string[] }
export interface FolderSearchResult extends TaggedFolder { matchedTerms: string[] }

const folders = folderIndex as TaggedFolder[]
const normalize = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('ru')

/** Prefix search on curated tags and teacher names only. */
export function searchFolders(query: string): FolderSearchResult[] {
  const prefix = normalize(query)
  if (!prefix) return []
  return folders.flatMap((folder) => {
    const matchedTerms = [...folder.tags, ...folder.teachers].filter((term) => normalize(term).startsWith(prefix))
    return matchedTerms.length ? [{ ...folder, matchedTerms: [...new Set(matchedTerms)] }] : []
  })
}
