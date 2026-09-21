import { describe, expect, it } from 'vitest'
import { isTelegramLaunchHash } from './location'

describe('Telegram launch URL', () => {
  it('recognizes Telegram launch parameters without changing app routes', () => {
    expect(isTelegramLaunchHash('#tgWebAppData=example&tgWebAppVersion=8.0')).toBe(true)
    expect(isTelegramLaunchHash('#/course/course-1')).toBe(false)
  })
})
