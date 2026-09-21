import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCloudflarePagesConfig } from './validate-cloudflare-pages-config.mjs'

const valid = { CLOUDFLARE_API_TOKEN: 'token', CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_PAGES_PROJECT: 'iu5-mini-app' }

test('accepts required Cloudflare Pages configuration', () => {
  assert.doesNotThrow(() => validateCloudflarePagesConfig(valid))
})

test('rejects missing required values and invalid project names', () => {
  assert.throws(() => validateCloudflarePagesConfig({ ...valid, CLOUDFLARE_API_TOKEN: '' }), /CLOUDFLARE_API_TOKEN/)
  assert.throws(() => validateCloudflarePagesConfig({ ...valid, CLOUDFLARE_PAGES_PROJECT: 'IU5 Mini App' }), /project name/)
})
