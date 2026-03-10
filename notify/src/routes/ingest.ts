import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'
import { logNotify } from '../logger.js'
import { broadcast, getClientCount } from '../sse.js'

const SendNotificationSchema = z.object({
  notificationId: z.string().max(128),
  title: z.string().max(32),
  body: z.string().max(128),
  targetUrl: z.string().url(),
  tokens: z.array(z.string()).max(100),
})

export const ingestRoute = new Hono()

/** Validate tokens and broadcast notification to SSE clients. Farcaster-compatible endpoint. */
ingestRoute.post('/', async (c) => {
  const rawBody = await c.req.json()
  logNotify('← request received', JSON.stringify(rawBody).slice(0, 300))

  const parsed = SendNotificationSchema.safeParse(rawBody)
  if (!parsed.success) {
    logNotify('validation error', parsed.error.issues)
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400)
  }

  const { notificationId, title, body, targetUrl, tokens } = parsed.data
  logNotify('parsed', `id=${notificationId} title="${title}" tokens=${tokens.length}`)

  const db = getDb()

  const successfulTokens: string[] = []
  const invalidTokens: string[] = []

  for (const token of tokens) {
    const row = db
      .prepare(`SELECT status FROM notification_tokens WHERE token = ?`)
      .get(token) as { status: string } | undefined

    const status = row?.status ?? 'unknown'
    logNotify('token check', `${token.slice(0, 8)}… → ${status}`)

    if (row?.status === 'active') {
      successfulTokens.push(token)
    } else {
      invalidTokens.push(token)
    }
  }

  logNotify('token validation result', `${successfulTokens.length} valid, ${invalidTokens.length} invalid`)

  if (successfulTokens.length > 0) {
    logNotify('broadcast', `"${title}" — ${body}`)
    logNotify('broadcast details', `targetUrl=${targetUrl} id=${notificationId} sseClients=${getClientCount()}`)

    broadcast('notification', {
      notificationId,
      title,
      body,
      targetUrl,
      timestamp: new Date().toISOString(),
    })

    logNotify('broadcast sent', `SSE event dispatched to ${getClientCount()} client(s)`)
  } else {
    logNotify('broadcast skipped', 'no valid tokens')
  }

  const response = {
    result: {
      successfulTokens,
      invalidTokens,
      rateLimitedTokens: [],
    },
  }
  logNotify('→ response', JSON.stringify(response))
  return c.json(response)
})
