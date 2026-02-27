import { Hono } from 'hono'
import { getDb } from '../db.js'
import type { TokenRecord } from '../types.js'

export const tokensRoute = new Hono()

/** List notification tokens, optionally filtered by status or fid. */
tokensRoute.get('/', (c) => {
  const db = getDb()
  const status = c.req.query('status')
  const fid = c.req.query('fid')

  let query = 'SELECT * FROM notification_tokens WHERE 1=1'
  const params: (string | number)[] = []

  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  if (fid) {
    query += ' AND fid = ?'
    params.push(Number(fid))
  }

  query += ' ORDER BY updated_at DESC'

  const tokens = db.prepare(query).all(...params) as TokenRecord[]

  return c.json({ tokens, count: tokens.length })
})
