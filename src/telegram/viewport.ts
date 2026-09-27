import { getTelegramWebApp } from './webapp'

const set = (name: string, value?: number) => value !== undefined && document.documentElement.style.setProperty(name, `${value}px`)

export const applyTelegramViewport = () => {
  const app = getTelegramWebApp()
  if (!app) return
  set('--tg-viewport-height', app.viewportHeight)
  set('--tg-viewport-stable-height', app.viewportStableHeight)
  const device = app.safeAreaInset
  const content = app.contentSafeAreaInset
  const deviceTop = device?.top ?? 0
  const contentTop = content?.top ?? 0
  set('--tg-header-clearance', deviceTop > 0 ? Math.max(0, 40 - Math.max(0, contentTop - deviceTop)) : 0)
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const deviceInset = device?.[side] ?? 0
    const contentInset = content?.[side] ?? 0
    set(`--tg-device-safe-area-${side}`, deviceInset)
    set(`--tg-content-safe-area-${side}`, contentInset)
    set(`--tg-safe-area-${side}`, Math.max(deviceInset, contentInset))
  }
}
