import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'

const NotificationDetailsSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
})

const WebhookEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('miniapp_added'),
    notificationDetails: NotificationDetailsSchema.optional(),
  }),
  z.object({
    event: z.literal('miniapp_removed'),
  }),
  z.object({
    event: z.literal('notifications_enabled'),
    notificationDetails: NotificationDetailsSchema,
  }),
  z.object({
    event: z.literal('notifications_disabled'),
  }),
])

const JfsSchema = z.object({
  header: z.string(),
  payload: z.string(),
  signature: z.string(),
})

export const webhookRoute = new Hono()

webhookRoute.post('/', async (c) => {
  const body = await c.req.json()

  let eventPayload: unknown
  let fid = 0

  // Try JFS (signed) format first, fall back to plain JSON
  const jfsParse = JfsSchema.safeParse(body)
  if (jfsParse.success) {
    const payloadJson = Buffer.from(
      jfsParse.data.payload,
      'base64url',
    ).toString()
    eventPayload = JSON.parse(payloadJson)
    try {
      const headerJson = Buffer.from(
        jfsParse.data.header,
        'base64url',
      ).toString()
      const header = JSON.parse(headerJson) as { fid?: number }
      fid = typeof header.fid === 'number' ? header.fid : 0
    } catch {
      // FID extraction failed, use default
    }
  } else {
    eventPayload = body
  }

  const parsed = WebhookEventSchema.safeParse(eventPayload)
  if (!parsed.success) {
    return c.json(
      { error: 'Invalid event payload', details: parsed.error.issues },
      400,
    )
  }

  const event = parsed.data
  const db = getDb()

  switch (event.event) {
    case 'miniapp_added':
    case 'notifications_enabled': {
      if (!event.notificationDetails) break
      const { url, token } = event.notificationDetails

      // Upsert: replace existing token for this fid if one exists
      db.prepare(
        `
        INSERT INTO notification_tokens (fid, token, notification_url, status, updated_at)
        VALUES (?, ?, ?, 'active', datetime('now'))
        ON CONFLICT(token) DO UPDATE SET
          status = 'active',
          notification_url = excluded.notification_url,
          updated_at = datetime('now')
      `,
      ).run(fid, token, url)

      console.log(
        `  \x1b[32m✓ WEBHOOK\x1b[0m ${event.event} — fid=${fid} token=${token.slice(0, 8)}… url=${url}`,
      )
      break
    }
    case 'miniapp_removed': {
      db.prepare(
        `UPDATE notification_tokens SET status = 'removed', updated_at = datetime('now') WHERE fid = ?`,
      ).run(fid)
      console.log(`  \x1b[33m✓ WEBHOOK\x1b[0m miniapp_removed — fid=${fid}`)
      break
    }
    case 'notifications_disabled': {
      db.prepare(
        `UPDATE notification_tokens SET status = 'disabled', updated_at = datetime('now') WHERE fid = ?`,
      ).run(fid)
      console.log(
        `  \x1b[33m✓ WEBHOOK\x1b[0m notifications_disabled — fid=${fid}`,
      )
      break
    }
  }

  return c.json({ success: true })
})
