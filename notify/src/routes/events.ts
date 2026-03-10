import { Hono } from 'hono'
import { logNotify } from '../logger.js'
import { addClient, getClientCount, removeClient } from '../sse.js'

export const eventsRoute = new Hono()

/** SSE endpoint that streams real-time notifications to connected clients. */
eventsRoute.get('/', (c) => {
  const clientId = crypto.randomUUID()
  logNotify('SSE client connected', `id=${clientId} total=${getClientCount() + 1}`)

  const stream = new ReadableStream({
    start(controller) {
      addClient(clientId, controller)

      // Send initial connection event
      const msg = `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`
      controller.enqueue(new TextEncoder().encode(msg))
      logNotify('SSE initial event sent', `event=connected clientId=${clientId}`)
    },
    cancel() {
      removeClient(clientId)
      logNotify('SSE client disconnected', `id=${clientId} remaining=${getClientCount()}`)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
