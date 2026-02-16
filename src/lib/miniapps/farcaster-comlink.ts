import type { Endpoint } from 'comlink'

export type SecureEndpoint = {
	endpoint: Endpoint
	dispose: () => void
}

/**
 * Create a Comlink Endpoint that only accepts messages from the given iframe window + origin.
 *
 * This is used to emulate Farcaster Mini App hosts, which talk to the iframe via Comlink over postMessage.
 */
export function createSecureIframeEndpoint({
	iframeWindow,
	targetOrigin,
}: {
	iframeWindow: Window
	targetOrigin: string
}): SecureEndpoint {
	const listeners = new Map<
		EventListenerOrEventListenerObject,
		EventListener
	>()
	const subscribedHandlers: EventListener[] = []

	const endpoint: Endpoint = {
		postMessage(message: unknown, transfer?: readonly Transferable[]) {
			iframeWindow.postMessage(
				message,
				targetOrigin,
				transfer ? Array.from(transfer) : [],
			)
		},
		addEventListener(_type, listener: EventListenerOrEventListenerObject) {
			const handler: EventListener = (event) => {
				if (!(event instanceof MessageEvent)) return
				if (event.source !== iframeWindow) return
				if (event.origin !== targetOrigin) return
				if (typeof listener === 'function') listener(event)
				else listener.handleEvent(event)
			}
			listeners.set(listener, handler)
			subscribedHandlers.push(handler)
			window.addEventListener('message', handler)
		},
		removeEventListener(_type, listener: EventListenerOrEventListenerObject) {
			const handler = listeners.get(listener)
			if (!handler) return
			window.removeEventListener('message', handler)
			listeners.delete(listener)
		},
	}

	return {
		endpoint,
		dispose: () => {
			for (const handler of subscribedHandlers) {
				window.removeEventListener('message', handler)
			}
			subscribedHandlers.length = 0
			listeners.clear()
		},
	}
}
