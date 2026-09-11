import { getTelegramWebApp } from './webapp'

const set = (name: string, value?: number) => value !== undefined && document.documentElement.style.setProperty(name, `${value}px`)

export const applyTelegramViewport = () => {
  const app = getTelegramWebApp()
  if (!app) return
  set('--tg-viewport-height', app.viewportHeight)
  set('--tg-viewport-stable-height', app.viewportStableHeight)
  const inset = app.contentSafeAreaInset ?? app.safeAreaInset
  set('--tg-safe-area-top', inset?.top)
  set('--tg-safe-area-right', inset?.right)
  set('--tg-safe-area-bottom', inset?.bottom)
  set('--tg-safe-area-left', inset?.left)
}
