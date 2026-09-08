import { describe, expect, it } from 'vitest'
import { staticMaterialsRepository } from './materials-repository'
import { isExternalHttpUrl } from '../platform/links'

describe('static materials repository', () => {
  it('searches a title, subject, category and keyword', async () => {
    await expect(staticMaterialsRepository.search('Э-101')).resolves.toHaveLength(1)
    await expect(staticMaterialsRepository.search('программирование')).resolves.toHaveLength(2)
    await expect(staticMaterialsRepository.search('lecture')).resolves.toHaveLength(3)
    await expect(staticMaterialsRepository.search('контроль версий')).resolves.toHaveLength(1)
  })
})

describe('external links', () => {
  it('allows only http(s) URLs', () => {
    expect(isExternalHttpUrl('https://disk.yandex.ru/')).toBe(true)
    expect(isExternalHttpUrl('javascript:alert(1)')).toBe(false)
  })
})
