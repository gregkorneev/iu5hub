import type { PlatformAdapter } from './types'
import { isExternalHttpUrl } from './links'

export const webPlatform: PlatformAdapter = {
  type: 'web',
  openLink(url) { if (isExternalHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer') },
  close() { window.history.back() },
  haptic() {},
  getUser() { return null },
}
