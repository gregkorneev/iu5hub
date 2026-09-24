import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeTelegram } from './init'

afterEach(() => vi.unstubAllGlobals())

describe('initializeTelegram', () => {
  it('keeps the selected launch mode and refreshes safe areas', () => {
    const listeners: Record<string, () => void> = {}
    const setProperty = vi.fn()
    const removeProperty = vi.fn()
    const app = {
      viewportHeight: 420,
      viewportStableHeight: 420,
      safeAreaInset: { top: 12, right: 0, bottom: 8, left: 0 },
      ready: vi.fn(),
      expand: vi.fn(),
      openLink: vi.fn(),
      onEvent: vi.fn((event: string, listener: () => void) => { listeners[event] = listener }),
      offEvent: vi.fn(),
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty, removeProperty } } })

    initializeTelegram()
    listeners.safeAreaChanged()

    expect(app.ready).toHaveBeenCalledOnce()
    expect(app.expand).not.toHaveBeenCalled()
    expect(app.onEvent).toHaveBeenCalledWith('contentSafeAreaChanged', expect.any(Function))
    expect(setProperty).toHaveBeenCalledWith('--tg-safe-area-top', '12px')
  })
})
