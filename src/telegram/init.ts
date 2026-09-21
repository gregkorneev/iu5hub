import { applyTelegramTheme } from './theme'
import { applyTelegramViewport } from './viewport'
import { getTelegramWebApp } from './webapp'

export const initializeTelegram = () => {
  const app = getTelegramWebApp()
  if (!app) return
  const refresh = () => { applyTelegramTheme(); applyTelegramViewport() }
  refresh()
  app.ready()
  app.onEvent('themeChanged', refresh)
  app.onEvent('viewportChanged', refresh)
  app.onEvent('safeAreaChanged', refresh)
  app.onEvent('contentSafeAreaChanged', refresh)
  app.onEvent('fullscreenChanged', refresh)
  document.documentElement.dataset.platform = 'telegram'
}
