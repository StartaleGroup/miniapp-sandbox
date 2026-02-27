import { Hono } from 'hono'
import { getDb } from '../db.js'
import { getClientCount } from '../sse.js'

const startTime = Date.now()

export const healthRoute = new Hono()

/** Return server status, uptime, active tokens, and SSE client count. */
healthRoute.get('/', (c) => {
  const db = getDb()
  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM notification_tokens WHERE status = 'active'`)
    .get() as { count: number }

  return c.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    activeTokens: count,
    sseClients: getClientCount(),
    version: '0.1.0',
  })
})
