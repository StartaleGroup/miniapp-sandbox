import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'
import { broadcast } from '../sse.js'

const SendRequestSchema = z.object({
  title: z.string().max(32),
  body: z.string().max(128),
  targetUrl: z.string().url(),
  notificationId: z.string().max(128).optional(),
  fids: z.array(z.number()).optional(),
})

export const sendRoute = new Hono()

sendRoute.post('/', async (c) => {
  const parsed = SendRequestSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400)
  }

  const { title, body, targetUrl, fids } = parsed.data
  const notificationId = parsed.data.notificationId ?? crypto.randomUUID()

  const db = getDb()

  // Query active tokens
  let tokens: { token: string; notification_url: string }[]
  if (fids && fids.length > 0) {
    const placeholders = fids.map(() => '?').join(',')
    tokens = db
      .prepare(
        `SELECT token, notification_url FROM notification_tokens WHERE status = 'active' AND fid IN (${placeholders})`,
      )
      .all(...fids) as typeof tokens
  } else {
    tokens = db
      .prepare(
        `SELECT token, notification_url FROM notification_tokens WHERE status = 'active'`,
      )
      .all() as typeof tokens
  }

  if (tokens.length === 0) {
    return c.json({
      success: true,
      results: [],
      totalSent: 0,
      totalFailed: 0,
      message:
        'No active tokens found. Has the miniapp called sdk.actions.addMiniApp() yet?',
    })
  }

  // Group tokens by notification_url
  const grouped = new Map<string, string[]>()
  for (const t of tokens) {
    const arr = grouped.get(t.notification_url) ?? []
    arr.push(t.token)
    grouped.set(t.notification_url, arr)
  }

  const results = []
  let totalSent = 0
  let totalFailed = 0

  for (const [notificationUrl, tokenList] of grouped) {
    try {
      const res = await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          title,
          body,
          targetUrl,
          tokens: tokenList,
        }),
      })

      const data = (await res.json()) as {
        result?: {
          successfulTokens: string[]
          invalidTokens: string[]
          rateLimitedTokens: string[]
        }
      }

      const result = data.result ?? {
        successfulTokens: [],
        invalidTokens: [],
        rateLimitedTokens: [],
      }

      results.push({ notificationUrl, ...result })
      totalSent += result.successfulTokens.length
      totalFailed +=
        result.invalidTokens.length + result.rateLimitedTokens.length

      // Mark invalid tokens in DB
      for (const invalidToken of result.invalidTokens) {
        db.prepare(
          `UPDATE notification_tokens SET status = 'removed', updated_at = datetime('now') WHERE token = ?`,
        ).run(invalidToken)
      }
    } catch (err) {
      results.push({
        notificationUrl,
        error: err instanceof Error ? err.message : 'Unknown error',
        successfulTokens: [],
        invalidTokens: tokenList,
        rateLimitedTokens: [],
      })
      totalFailed += tokenList.length
    }
  }

  // Also broadcast via SSE for local dev convenience
  broadcast('notification', {
    notificationId,
    title,
    body,
    targetUrl,
    timestamp: new Date().toISOString(),
  })

  console.log(
    `  \x1b[36m✓ SEND\x1b[0m "${title}" — ${body} (${totalSent} sent, ${totalFailed} failed)`,
  )

  return c.json({ success: true, results, totalSent, totalFailed })
})
