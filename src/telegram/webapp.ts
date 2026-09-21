export interface TelegramUser { id: number; first_name: string; username?: string; language_code?: string }

export interface TelegramWebApp {
  initDataUnsafe?: { user?: TelegramUser }
  themeParams?: Record<string, string>
  viewportHeight?: number
  viewportStableHeight?: number
  isExpanded?: boolean
  isFullscreen?: boolean
  safeAreaInset?: { top: number; right: number; bottom: number; left: number }
  contentSafeAreaInset?: { top: number; right: number; bottom: number; left: number }
  ready(): void
  expand(): void
  openLink(url: string): void
  onEvent(event: 'themeChanged' | 'viewportChanged' | 'safeAreaChanged' | 'contentSafeAreaChanged' | 'fullscreenChanged', listener: () => void): void
  offEvent(event: 'themeChanged' | 'viewportChanged' | 'safeAreaChanged' | 'contentSafeAreaChanged' | 'fullscreenChanged', listener: () => void): void
  BackButton?: { show(): void; hide(): void; onClick(listener: () => void): void; offClick(listener: () => void): void }
  HapticFeedback?: { impactOccurred(type: 'light' | 'medium' | 'heavy'): void }
}

export const getTelegramWebApp = (): TelegramWebApp | undefined =>
  (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
