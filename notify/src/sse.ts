/** Simple SSE broadcast manager for pushing notifications to connected clients. */

type SseClient = {
  id: string
  controller: ReadableStreamDefaultController
}

const clients: SseClient[] = []

/** Register an SSE client connection. */
export function addClient(
  id: string,
  controller: ReadableStreamDefaultController,
) {
  clients.push({ id, controller })
}

/** Remove a disconnected SSE client. */
export function removeClient(id: string) {
  const idx = clients.findIndex((c) => c.id === id)
  if (idx !== -1) clients.splice(idx, 1)
}

/** Send an SSE event to all connected clients. */
export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(payload)
  for (const client of clients) {
    try {
      client.controller.enqueue(encoded)
    } catch {
      // Client disconnected, will be cleaned up
    }
  }
}

/** Return the number of connected SSE clients. */
export function getClientCount() {
  return clients.length
}
