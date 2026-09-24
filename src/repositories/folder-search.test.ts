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
    expect(new Set(results.map(({ objectKey }) => objectKey)).size).toBe(results.length)
  })

  it('returns no folders for empty or unmatched prefixes', () => {
    expect(searchFolders('   ')).toEqual([])
    expect(searchFolders('несуществующий-тег')).toEqual([])
  })
})
