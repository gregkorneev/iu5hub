export interface PlatformUser { id: string; firstName: string; username?: string }
export interface PlatformAdapter {
  type: 'web' | 'telegram'
  openLink(url: string): void
  close(): void
  haptic(type?: 'light' | 'medium' | 'heavy' | 'success'): void
  getUser(): PlatformUser | null
}

export interface TelegramWebApp {
  initDataUnsafe?: { user?: { id: number; first_name: string; username?: string } }
  themeParams?: Record<string, string>
  ready(): void
  expand(): void
  close(): void
  openLink(url: string): void
  HapticFeedback?: { impactOccurred(type: 'light' | 'medium' | 'heavy'): void; notificationOccurred(type: 'success'): void }
}
