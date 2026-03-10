import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db.js'
import { logWebhook } from '../logger.js'

const NotificationDetailsSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
})

const WebhookEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('miniapp_added'),
    notificationDetails: NotificationDetailsSchema.optional(),
    miniappOrigin: z.string().optional(),
  }),
  z.object({
    event: z.literal('miniapp_removed'),
    miniappOrigin: z.string().optional(),
  }),
  z.object({
    event: z.literal('notifications_enabled'),
    notificationDetails: NotificationDetailsSchema,
    miniappOrigin: z.string().optional(),
  }),
  z.object({
    event: z.literal('notifications_disabled'),
    miniappOrigin: z.string().optional(),
  }),
])

const JfsSchema = z.object({
  header: z.string(),
  payload: z.string(),
  signature: z.string(),
})

export const webhookRoute = new Hono()

/** Handle miniapp lifecycle events (added, removed, notifications enabled/disabled). */
webhookRoute.post('/', async (c) => {
  const body = await c.req.json()
  logWebhook('← request received', JSON.stringify(body).slice(0, 200))

  let eventPayload: unknown
  let fid = 0

  // Try JFS (signed) format first, fall back to plain JSON
  const jfsParse = JfsSchema.safeParse(body)
  if (jfsParse.success) {
    logWebhook('format', 'JFS (signed)')
    const payloadJson = Buffer.from(jfsParse.data.payload, 'base64url').toString()
    eventPayload = JSON.parse(payloadJson)
    try {
      const headerJson = Buffer.from(jfsParse.data.header, 'base64url').toString()
      const header = JSON.parse(headerJson) as { fid?: number }
      fid = typeof header.fid === 'number' ? header.fid : 0
      logWebhook('header', `fid=${fid}`)
    } catch {
      logWebhook('header', 'FID extraction failed, using fid=0')
    }
    logWebhook('payload', JSON.stringify(eventPayload).slice(0, 200))
  } else {
    logWebhook('format', 'plain JSON')
    eventPayload = body
  }

  const parsed = WebhookEventSchema.safeParse(eventPayload)
  if (!parsed.success) {
    logWebhook('validation error', parsed.error.issues)
    return c.json(
      { error: 'Invalid event payload', details: parsed.error.issues },
      400,
    )
  }

  const event = parsed.data
  const db = getDb()
  const miniappOrigin = ('miniappOrigin' in event ? event.miniappOrigin : undefined) ?? ''

  logWebhook('event', `${event.event} fid=${fid} origin=${miniappOrigin}`)

  switch (event.event) {
    case 'miniapp_added':
    case 'notifications_enabled': {
      if (!event.notificationDetails) {
        logWebhook(event.event, 'no notificationDetails — skipping token registration')
        break
      }
      const { url, token } = event.notificationDetails

      // Deactivate previous tokens for this fid+miniapp pair before inserting new one
      const removed = db.prepare(
        `UPDATE notification_tokens SET status = 'removed', updated_at = datetime('now') WHERE fid = ? AND miniapp_origin = ?`,
      ).run(fid, miniappOrigin)
      if (removed.changes > 0) {
        logWebhook('token', `deactivated ${removed.changes} previous token(s) for fid=${fid} origin=${miniappOrigin}`)
      }

      db.prepare(
        `INSERT INTO notification_tokens (fid, token, notification_url, miniapp_origin, status, updated_at)
         VALUES (?, ?, ?, ?, 'active', datetime('now'))`,
      ).run(fid, token, url, miniappOrigin)

      logWebhook(event.event, `✓ token registered — fid=${fid} token=${token.slice(0, 8)}… url=${url}`)
      break
    }
    case 'miniapp_removed': {
      const removed = db.prepare(
        `UPDATE notification_tokens SET status = 'removed', updated_at = datetime('now') WHERE fid = ? AND miniapp_origin = ?`,
      ).run(fid, miniappOrigin)
      logWebhook('miniapp_removed', `${removed.changes} token(s) marked removed — fid=${fid} origin=${miniappOrigin}`)
      break
    }
    case 'notifications_disabled': {
      const disabled = db.prepare(
        `UPDATE notification_tokens SET status = 'disabled', updated_at = datetime('now') WHERE fid = ? AND miniapp_origin = ?`,
      ).run(fid, miniappOrigin)
      logWebhook('notifications_disabled', `${disabled.changes} token(s) disabled — fid=${fid} origin=${miniappOrigin}`)
      break
    }
  }

  logWebhook('→ response', '{ success: true }')
  return c.json({ success: true })
})
