import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCloudflarePagesConfig } from './validate-cloudflare-pages-config.mjs'

const valid = { CLOUDFLARE_API_TOKEN: 'token', CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_PAGES_PROJECT: 'iu5-mini-app', VITE_ANALYTICS_API_BASE: 'https://example.workers.dev' }

test('accepts required Cloudflare Pages configuration', () => {
  assert.doesNotThrow(() => validateCloudflarePagesConfig(valid))
})

test('rejects missing required values and invalid project names', () => {
  assert.throws(() => validateCloudflarePagesConfig({ ...valid, CLOUDFLARE_API_TOKEN: '' }), /CLOUDFLARE_API_TOKEN/)
  assert.throws(() => validateCloudflarePagesConfig({ ...valid, VITE_ANALYTICS_API_BASE: '' }), /VITE_ANALYTICS_API_BASE/)
  for (const base of ['http://example.workers.dev', 'https://example.workers.dev/path', 'https://example.workers.dev?x=1', 'https://localhost', 'https://127.0.0.1', 'https://[::1]']) {
    assert.throws(() => validateCloudflarePagesConfig({ ...valid, VITE_ANALYTICS_API_BASE: base }), /public HTTPS origin/)
  }
  assert.throws(() => validateCloudflarePagesConfig({ ...valid, CLOUDFLARE_PAGES_PROJECT: 'IU5 Mini App' }), /project name/)
})
