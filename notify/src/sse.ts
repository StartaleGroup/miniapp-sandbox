/** Simple SSE broadcast manager for pushing notifications to connected clients. */

type SseClient = {
  id: string
  controller: ReadableStreamDefaultController
}

const clients: SseClient[] = []

export function addClient(
  id: string,
  controller: ReadableStreamDefaultController,
) {
  clients.push({ id, controller })
}

export function removeClient(id: string) {
  const idx = clients.findIndex((c) => c.id === id)
  if (idx !== -1) clients.splice(idx, 1)
}

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

export function getClientCount() {
  return clients.length
}
