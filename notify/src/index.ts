import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config } from './config.js'
import { initDb } from './db.js'
import { eventsRoute } from './routes/events.js'
import { healthRoute } from './routes/health.js'
import { ingestRoute } from './routes/ingest.js'
import { sendRoute } from './routes/send.js'
import { tokensRoute } from './routes/tokens.js'
import { webhookRoute } from './routes/webhook.js'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Custom endpoint logger for better visibility
app.use('*', async (c, next) => {
  const method = c.req.method
  const path = c.req.path
  const endpointName =
    path === '/webhook' ? 'WEBHOOK' :
    path === '/api/miniapps-notifications' ? 'NOTIFICATION_INGEST' :
    path === '/send' ? 'SEND' :
    path === '/events' ? 'SSE_EVENTS' :
    path === '/tokens' ? 'TOKENS' :
    path === '/health' ? 'HEALTH' :
    path

  console.log(`\x1b[90m→\x1b[0m \x1b[1m${method}\x1b[0m \x1b[35m${endpointName}\x1b[0m \x1b[90m${path}\x1b[0m`)
  await next()
})

// Routes
app.route('/webhook', webhookRoute)
app.route('/api/miniapps-notifications', ingestRoute)
app.route('/send', sendRoute)
app.route('/events', eventsRoute)
app.route('/tokens', tokensRoute)
app.route('/health', healthRoute)

// Initialize database and start
initDb()

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log('')
  console.log('\x1b[35m  notify\x1b[0m — MiniApp Sandbox Notification Server')
  console.log('')
  console.log(`  Server:        http://localhost:${info.port}`)
  console.log(`  Webhook URL:   http://localhost:${info.port}/webhook`)
  console.log(`  Notification:  http://localhost:${info.port}/api/miniapps-notifications`)
  console.log(`  Send API:      POST http://localhost:${info.port}/send`)
  console.log(`  SSE Stream:    http://localhost:${info.port}/events`)
  console.log(`  Tokens:        http://localhost:${info.port}/tokens`)
  console.log(`  Health:        http://localhost:${info.port}/health`)
  console.log('')
})
