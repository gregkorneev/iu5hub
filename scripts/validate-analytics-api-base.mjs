export function validateAnalyticsApiBase(value = process.env.VITE_ANALYTICS_API_BASE) {
  let url
  try { url = new URL(value) } catch { throw new Error('VITE_ANALYTICS_API_BASE must be a public HTTPS origin') }
  const loopback = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.startsWith('127.') || url.hostname === '[::1]'
  if (url.protocol !== 'https:' || (value !== url.origin && value !== `${url.origin}/`) || loopback) {
    throw new Error('VITE_ANALYTICS_API_BASE must be a public HTTPS origin')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) validateAnalyticsApiBase()
