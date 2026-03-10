import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'
import { logNotify } from '../logger.js'
import { broadcast, getClientCount } from '../sse.js'

const SendRequestSchema = z.object({
  title: z.string().max(32),
  body: z.string().max(128),
  targetUrl: z.string().url(),
  notificationId: z.string().max(128).optional(),
  fids: z.array(z.number()).optional(),
})

export const sendRoute = new Hono()

/** Send a notification to active tokens, optionally filtered by fid. */
sendRoute.post('/', async (c) => {
  const rawBody = await c.req.json()
  logNotify('← request received', JSON.stringify(rawBody).slice(0, 300))

  const parsed = SendRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    logNotify('validation error', parsed.error.issues)
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400)
  }

  const { title, body, targetUrl, fids } = parsed.data
  const notificationId = parsed.data.notificationId ?? crypto.randomUUID()
  logNotify('parsed', `id=${notificationId} title="${title}" fids=${fids?.join(',') ?? 'all'}`)

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
    logNotify('token query', `filtered by fid=[${fids.join(',')}] → ${tokens.length} token(s)`)
  } else {
    tokens = db
      .prepare(`SELECT token, notification_url FROM notification_tokens WHERE status = 'active'`)
      .all() as typeof tokens
    logNotify('token query', `all active → ${tokens.length} token(s)`)
  }

  if (tokens.length === 0) {
    logNotify('send skipped', 'no active tokens found')
    return c.json({
      success: true,
      results: [],
      totalSent: 0,
      totalFailed: 0,
      message: 'No active tokens found. Has the miniapp called sdk.actions.addMiniApp() yet?',
    })
  }

  // Group tokens by notification_url
  const grouped = new Map<string, string[]>()
  for (const t of tokens) {
    const arr = grouped.get(t.notification_url) ?? []
    arr.push(t.token)
    grouped.set(t.notification_url, arr)
  }
  logNotify('grouped', `${grouped.size} unique notification URL(s)`)

  const results = []
  let totalSent = 0
  let totalFailed = 0

  for (const [notificationUrl, tokenList] of grouped) {
    logNotify('→ POST', `${notificationUrl} (${tokenList.length} token(s))`)
    logNotify('  payload', `title="${title}" body="${body}" targetUrl=${targetUrl}`)

    try {
      const res = await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, title, body, targetUrl, tokens: tokenList }),
      })

      logNotify('← response', `${notificationUrl} → HTTP ${res.status} ${res.statusText}`)

      if (!res.ok) {
        throw new Error(`Notification endpoint ${notificationUrl} responded with ${res.status} ${res.statusText}`)
      }

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

      logNotify('  result', `${result.successfulTokens.length} sent, ${result.invalidTokens.length} invalid, ${result.rateLimitedTokens.length} rate-limited`)

      results.push({ notificationUrl, ...result })
      totalSent += result.successfulTokens.length
      totalFailed += result.invalidTokens.length + result.rateLimitedTokens.length

      // Mark invalid tokens in DB
      for (const invalidToken of result.invalidTokens) {
        db.prepare(
          `UPDATE notification_tokens SET status = 'removed', updated_at = datetime('now') WHERE token = ?`,
        ).run(invalidToken)
        logNotify('  token invalidated', `${invalidToken.slice(0, 8)}… marked removed`)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      logNotify('  error', errMsg)
      results.push({
        notificationUrl,
        error: errMsg,
        successfulTokens: [],
        invalidTokens: tokenList,
        rateLimitedTokens: [],
      })
      totalFailed += tokenList.length
    }
  }

  // Also broadcast via SSE for local dev convenience
  logNotify('broadcast', `SSE event to ${getClientCount()} client(s)`)
  broadcast('notification', {
    notificationId,
    title,
    body,
    targetUrl,
    timestamp: new Date().toISOString(),
  })

  logNotify('→ response', `success=true totalSent=${totalSent} totalFailed=${totalFailed}`)
  return c.json({ success: true, results, totalSent, totalFailed })
})
