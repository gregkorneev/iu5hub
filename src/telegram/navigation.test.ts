import { describe, expect, it, vi } from 'vitest'
import { goBack } from './navigation'

describe('goBack', () => {
  it('uses browser history when the app has a prior entry', () => {
    const navigate = vi.fn()
    goBack(navigate, 2)
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('returns to the catalog for a direct link', () => {
    const navigate = vi.fn()
    goBack(navigate, 0)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})
