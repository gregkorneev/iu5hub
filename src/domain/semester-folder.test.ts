import { describe, expect, it } from 'vitest'
import { semesterFromFolderName } from './semester-folder'

describe('semester folder names', () => {
  it('extracts the number before sem', () => {
    expect(semesterFromFolderName('1 sem')).toBe('1')
    expect(semesterFromFolderName('2SEM')).toBe('2')
    expect(semesterFromFolderName('1 Семестр')).toBe('1')
    expect(semesterFromFolderName('Материалы')).toBeUndefined()
  })
})
