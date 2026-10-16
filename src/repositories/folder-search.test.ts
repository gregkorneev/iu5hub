import { describe, expect, it } from 'vitest'
import { searchFolders } from './folder-search'

describe('tagged-folder search', () => {
  it('matches a tag prefix from one character, independent of case', () => {
    const lower = searchFolders('гриб')
    const upper = searchFolders('ГРИБ')
    expect(lower.map(({ objectKey }) => objectKey)).toEqual(upper.map(({ objectKey }) => objectKey))
    expect(lower[0]?.matchedTerms).toContain('Грибов')
  })

  it('treats tags and teachers equally and returns each folder once', () => {
    const results = searchFolders('а')
    const geometry = results.find(({ name }) => name === 'Аналитическая геометрия')
    expect(geometry?.matchedTerms).toContain('Ангем')
    expect(geometry?.diskPath).toBe('/1 Семестр/Аналитическая геометрия')
    expect(new Set(results.map(({ objectKey }) => objectKey)).size).toBe(results.length)
  })

  it('keeps course 2 tagged paths relative to its new shared folder', () => {
    const folder = searchFolders('АСОИУ').find(({ courseId }) => courseId === 'course-2')
    expect(folder?.diskPath).toBe('/3 sem/Архитектура АСОИУ')
  })

  it('returns no folders for empty or unmatched prefixes', () => {
    expect(searchFolders('   ')).toEqual([])
    expect(searchFolders('несуществующий-тег')).toEqual([])
  })
})
