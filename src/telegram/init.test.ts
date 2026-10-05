import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeTelegram } from './init'
import { applyTelegramViewport } from './viewport'

afterEach(() => vi.unstubAllGlobals())

describe('initializeTelegram', () => {
  it('expands and requests Telegram fullscreen once, then refreshes safe areas', () => {
    const listeners: Record<string, () => void> = {}
    const setProperty = vi.fn()
    const removeProperty = vi.fn()
    const app = {
      initData: 'query_id=test',
      viewportHeight: 420,
      viewportStableHeight: 420,
      safeAreaInset: { top: 12, right: 0, bottom: 8, left: 0 },
      themeParams: { bg_color: '#123456' },
      ready: vi.fn(),
      expand: vi.fn(),
      requestFullscreen: vi.fn(),
      setHeaderColor: vi.fn(),
      isVersionAtLeast: vi.fn(() => true),
      isFullscreen: false,
      openLink: vi.fn(),
      onEvent: vi.fn((event: string, listener: () => void) => { listeners[event] = listener }),
      offEvent: vi.fn(),
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty, removeProperty } }, querySelector: vi.fn(() => null) })

    initializeTelegram()
    listeners.safeAreaChanged()

    expect(app.ready).toHaveBeenCalledOnce()
    expect(app.expand).toHaveBeenCalledOnce()
    expect(app.requestFullscreen).toHaveBeenCalledOnce()
    expect(app.isVersionAtLeast).toHaveBeenCalledWith('8.0')
    expect(app.onEvent).toHaveBeenCalledWith('contentSafeAreaChanged', expect.any(Function))
    expect(app.onEvent).toHaveBeenCalledWith('fullscreenFailed', expect.any(Function))
    expect(app.setHeaderColor).toHaveBeenCalledWith('#123456')
    expect(setProperty).toHaveBeenCalledWith('--tg-safe-area-top', '12px')
  })

  it('keeps expanded fallback when fullscreen is unsupported or already active', () => {
    const app = {
      ready: vi.fn(), expand: vi.fn(), requestFullscreen: vi.fn(), isFullscreen: true,
      isVersionAtLeast: vi.fn(() => true), onEvent: vi.fn(), openLink: vi.fn(),
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty: vi.fn(), removeProperty: vi.fn() } }, querySelector: vi.fn(() => null) })
    initializeTelegram()
    expect(app.expand).toHaveBeenCalledOnce()
    expect(app.requestFullscreen).not.toHaveBeenCalled()

    app.isFullscreen = false
    app.isVersionAtLeast = vi.fn(() => false)
    initializeTelegram()
    expect(app.requestFullscreen).not.toHaveBeenCalled()
  })

  it('does not crash when the fullscreen API is missing or throws', () => {
    const app = {
      ready: vi.fn(), expand: vi.fn(), requestFullscreen: undefined as (() => void) | undefined,
      isFullscreen: false, isVersionAtLeast: vi.fn(() => true), onEvent: vi.fn(), openLink: vi.fn(),
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty: vi.fn(), removeProperty: vi.fn() } }, querySelector: vi.fn(() => null) })
    expect(() => initializeTelegram()).not.toThrow()
    expect(app.expand).toHaveBeenCalledOnce()

    app.requestFullscreen = vi.fn(() => { throw new Error('unsupported') })
    expect(() => initializeTelegram()).not.toThrow()
    expect(app.expand).toHaveBeenCalledTimes(3)
  })

  it('falls back to expanded mode when Telegram reports fullscreen failure', () => {
    const listeners: Record<string, () => void> = {}
    const app = {
      ready: vi.fn(), expand: vi.fn(), requestFullscreen: vi.fn(), isFullscreen: false,
      isVersionAtLeast: vi.fn(() => true), onEvent: vi.fn((event: string, listener: () => void) => { listeners[event] = listener }),
      openLink: vi.fn(),
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty: vi.fn(), removeProperty: vi.fn() } }, querySelector: vi.fn(() => null) })
    initializeTelegram()
    listeners.fullscreenFailed()
    expect(app.requestFullscreen).toHaveBeenCalledOnce()
    expect(app.expand).toHaveBeenCalledTimes(2)
  })

  it('combines device and content safe areas and refreshes the live viewport height', () => {
    const setProperty = vi.fn()
    const app = {
      viewportHeight: 700, viewportStableHeight: 690,
      safeAreaInset: { top: 20, right: 4, bottom: 16, left: 4 },
      contentSafeAreaInset: { top: 72, right: 0, bottom: 32, left: 0 },
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', { documentElement: { style: { setProperty } } })
    applyTelegramViewport()
    expect(setProperty).toHaveBeenCalledWith('--tg-viewport-height', '700px')
    expect(setProperty).toHaveBeenCalledWith('--tg-device-safe-area-top', '20px')
    expect(setProperty).toHaveBeenCalledWith('--tg-content-safe-area-top', '72px')
    expect(setProperty).toHaveBeenCalledWith('--tg-safe-area-top', '72px')
    expect(setProperty).toHaveBeenCalledWith('--tg-safe-area-bottom', '32px')
  })

  it('updates browser chrome color when Telegram changes theme', () => {
    const listeners: Record<string, () => void> = {}
    const meta = { setAttribute: vi.fn() }
    const app = {
      initData: 'query_id=test',
      colorScheme: 'light',
      ready: vi.fn(),
      expand: vi.fn(),
      onEvent: vi.fn((event: string, listener: () => void) => { listeners[event] = listener }),
      BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
    }
    vi.stubGlobal('window', { Telegram: { WebApp: app } })
    vi.stubGlobal('document', {
      documentElement: { dataset: {}, style: { setProperty: vi.fn(), removeProperty: vi.fn() } },
      querySelector: vi.fn((selector: string) => selector === 'meta[name="theme-color"]' ? meta : null),
    })

    initializeTelegram()
    expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#f6faff')
    app.colorScheme = 'dark'
    listeners.themeChanged()
    expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#0d203a')
    app.colorScheme = 'light'
    listeners.themeChanged()
    expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#f6faff')
  })
})
