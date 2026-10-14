import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
const scheduleWorkflow = readFileSync(new URL('../.github/workflows/schedule-sync.yml', import.meta.url), 'utf8')
const beta = wrangler.split('[env.beta]')[1]
const productionWorker = wrangler.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
const betaWorker = beta?.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
const productionD1 = wrangler.match(/\[\[d1_databases\]\][\s\S]*?database_id\s*=\s*"([^"]+)"/)?.[1]
const betaD1 = beta?.match(/\[\[env\.beta\.d1_databases\]\][\s\S]*?database_id\s*=\s*"([^"]+)"/)?.[1]

test('beta uses a separate Worker, D1, Pages origin and dashboard', () => {
  assert.ok(beta)
  assert.notEqual(betaWorker, productionWorker)
  assert.notEqual(betaD1, productionD1)
  assert.match(beta, /ANALYTICS_ALLOWED_ORIGIN\s*=\s*"https:\/\/beta\.iu5hub\.pages\.dev"/)
  assert.match(beta, /ADMIN_DASHBOARD_URL\s*=\s*"https:\/\/beta\.iu5hub\.pages\.dev\/#\/admin\/stats"/)
  assert.doesNotMatch(wrangler, /TELEGRAM_BOT_TOKEN\s*=/)
  assert.doesNotMatch(wrangler, /ANALYTICS_HMAC_SECRET\s*=/)
  assert.doesNotMatch(wrangler, /USER_ID_HMAC_SECRET\s*=/)
  assert.doesNotMatch(wrangler, /TELEGRAM_WEBHOOK_SECRET\s*=/)
  assert.doesNotMatch(wrangler, /SUPPORT_ENCRYPTION_KEY\s*=/)
  assert.doesNotMatch(wrangler, /ADMIN_TELEGRAM_IDS\s*=/)
})

test('scheduled refresh syncs only generated schedule data into beta without force-push', () => {
  const betaSync = scheduleWorkflow.split('name: Copy only schedule data to beta')[1]
  assert.ok(betaSync)
  assert.match(betaSync, /git fetch origin beta/)
  assert.match(betaSync, /git switch --detach FETCH_HEAD/)
  assert.match(betaSync, /rm -rf public\/data\/schedule/)
  assert.match(betaSync, /npm run schedule:validate/)
  assert.match(betaSync, /git add public\/data\/schedule/)
  assert.match(betaSync, /git push origin HEAD:beta/)
  assert.doesNotMatch(betaSync, /git add -A|git add \./)
  assert.doesNotMatch(betaSync, /push\s+--force/)
})
