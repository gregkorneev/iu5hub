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
  document.documentElement.dataset.platform = 'telegram'
}
