import { initializeTelegram, telegramPlatform } from './telegram'
import type { PlatformAdapter } from './types'
import { webPlatform } from './web'

const hasTelegram = () => Boolean((window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp)
export const platform: PlatformAdapter = hasTelegram() ? telegramPlatform : webPlatform
export const initializePlatform = () => { if (platform.type === 'telegram') initializeTelegram() }
export type { PlatformAdapter, PlatformUser } from './types'
