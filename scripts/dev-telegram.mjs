import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1'], { stdio: ['inherit', 'pipe', 'pipe'] })
let tunnel
let stopping = false
let startedTunnel = false

const forward = (stream) => (chunk) => {
  process[stream].write(chunk)
  const localUrl = chunk.toString().replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').match(/Local:\s+(https?:\/\/[^\s]+)/)?.[1]
  if (localUrl && !startedTunnel) startTunnel(new URL(localUrl).port || '80')
}

const stop = (code = 0) => {
  if (stopping) return
  stopping = true
  tunnel?.kill('SIGTERM')
  vite.kill('SIGTERM')
  setTimeout(() => process.exit(code), 1000).unref()
}

const startTunnel = (port) => {
  startedTunnel = true
  const localUrl = `http://127.0.0.1:${port}`
  console.log(`\nStarting Cloudflare Quick Tunnel for ${localUrl}…`)
  tunnel = spawn('cloudflared', ['tunnel', '--protocol', 'http2', '--url', localUrl], { stdio: ['ignore', 'pipe', 'pipe'] })
  const forwardTunnel = (chunk) => {
    process.stderr.write(chunk)
    const publicUrl = chunk.toString().match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i)?.[0]
    if (publicUrl) console.log(`\nTelegram Mini App URL: ${publicUrl}\n`)
  }
  tunnel.stdout.on('data', forwardTunnel)
  tunnel.stderr.on('data', forwardTunnel)
  tunnel.on('error', (error) => {
    console.error(`Unable to start cloudflared: ${error.message}`)
    console.error('Install cloudflared, then run npm run dev:telegram again.')
    stop(1)
  })
  tunnel.on('close', (code) => { if (!stopping) stop(code ?? 1) })
}

vite.stdout.on('data', forward('stdout'))
vite.stderr.on('data', forward('stderr'))
vite.on('error', (error) => { console.error(`Unable to start Vite: ${error.message}`); stop(1) })
vite.on('close', (code) => { if (!stopping) stop(code ?? 1) })
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
