import { validateAnalyticsApiBase } from './validate-analytics-api-base.mjs'

const projectPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function validateCloudflarePagesConfig(env = process.env) {
  for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PAGES_PROJECT', 'VITE_ANALYTICS_API_BASE']) {
    if (!env[name]) throw new Error(`${name} is required`)
  }
  if (!projectPattern.test(env.CLOUDFLARE_PAGES_PROJECT)) throw new Error('CLOUDFLARE_PAGES_PROJECT must be a lowercase Pages project name')
  validateAnalyticsApiBase(env.VITE_ANALYTICS_API_BASE)
}

if (import.meta.url === `file://${process.argv[1]}`) validateCloudflarePagesConfig()
