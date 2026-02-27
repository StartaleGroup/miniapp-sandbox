import { Hono } from 'hono'
import { addClient, removeClient } from '../sse.js'

export const eventsRoute = new Hono()

/** SSE endpoint that streams real-time notifications to connected clients. */
eventsRoute.get('/', (c) => {
  const clientId = crypto.randomUUID()
  console.log(`  \x1b[35m✓ SSE_EVENTS\x1b[0m Client connected: ${clientId}`)

  const stream = new ReadableStream({
    start(controller) {
      addClient(clientId, controller)

      // Send initial connection event
      const msg = `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`
      controller.enqueue(new TextEncoder().encode(msg))
    },
    cancel() {
      console.log(`  \x1b[90m✗ SSE_EVENTS\x1b[0m Client disconnected: ${clientId}`)
      removeClient(clientId)
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
