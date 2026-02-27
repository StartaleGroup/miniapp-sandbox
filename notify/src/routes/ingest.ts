import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'
import { broadcast } from '../sse.js'

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
  const parsed = SendNotificationSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400)
  }

  const { notificationId, title, body, targetUrl, tokens } = parsed.data
  const db = getDb()

  const successfulTokens: string[] = []
  const invalidTokens: string[] = []

  for (const token of tokens) {
    const row = db
      .prepare(`SELECT status FROM notification_tokens WHERE token = ?`)
      .get(token) as { status: string } | undefined

    if (row?.status === 'active') {
      successfulTokens.push(token)
    } else {
      invalidTokens.push(token)
    }
  }

  if (successfulTokens.length > 0) {
    console.log(
      `  \x1b[36m✓ NOTIFICATION_INGEST\x1b[0m "${title}" — ${body}` +
        `\n    targetUrl: ${targetUrl}` +
        `\n    id: ${notificationId}` +
        `\n    tokens: ${successfulTokens.length} ok, ${invalidTokens.length} invalid`,
    )

    // Broadcast to SSE clients (sandbox UI)
    broadcast('notification', {
      notificationId,
      title,
      body,
      targetUrl,
      timestamp: new Date().toISOString(),
    })
  }

  return c.json({
    result: {
      successfulTokens,
      invalidTokens,
      rateLimitedTokens: [],
    },
  })
})
