import { applyTelegramTheme } from './theme'
import { applyTelegramViewport } from './viewport'
import { getTelegramWebApp } from './webapp'

export const initializeTelegram = () => {
  const app = getTelegramWebApp()
  if (!app) return
  const refresh = () => { applyTelegramTheme(); applyTelegramViewport() }
  refresh()
  app.ready()
  app.expand()
  app.onEvent('themeChanged', refresh)
  app.onEvent('viewportChanged', refresh)
  app.onEvent('safeAreaChanged', refresh)
  app.onEvent('contentSafeAreaChanged', refresh)
  app.onEvent('fullscreenChanged', refresh)
  app.onEvent('fullscreenFailed', () => { refresh(); if (!app.isFullscreen) app.expand() })
  try {
    const fullscreenSupported = app.isVersionAtLeast
      ? app.isVersionAtLeast('8.0')
      : Boolean(app.requestFullscreen && app.isFullscreen !== undefined)
    if (fullscreenSupported && app.requestFullscreen && !app.isFullscreen) app.requestFullscreen()
  } catch { app.expand() }
  document.documentElement.dataset.platform = 'telegram'
}
