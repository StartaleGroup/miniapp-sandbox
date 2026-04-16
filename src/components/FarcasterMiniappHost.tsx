/**
 * FarcasterMiniappHost - Farcaster MiniApp Client/Host Implementation
 *
 * Implements the Farcaster client/host side of the MiniApp protocol.
 * Hosts miniapps in an iframe and provides the Farcaster SDK host API
 * including wallet access, notifications, and frame interactions.
 */
import { expose } from 'comlink'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createPublicClient, http } from 'viem'
import { soneium } from 'viem/chains'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { createSecureIframeEndpoint } from '~/lib/miniapps/farcaster-comlink'
import { NOTIFICATION_SEND_URL, NOTIFICATIONS_API_KEY, WEBHOOK_URL } from '~/lib/notifications-config'
import { MINIAPP_ALLOWED_ORIGINS } from '~/pages/configMiniApps'


/** EIP-1193 compliant RPC error. */
class ProviderRpcError extends Error {
	code: number
	details?: string
	constructor(code: number, message: string, details?: string) {
		super(message)
		this.code = code
		this.details = details
	}
}

/** Parse a URL string, returning null on failure. */
function safeParseUrl(raw: string): URL | null {
	try {
		return new URL(raw)
	} catch {
		return null
	}
}

// ============================================================================
// Host Configuration Helpers (pure functions, defined outside component)
// ============================================================================


/** Create EIP-6963 provider metadata. */
function createProviderInfo() {
	return {
		icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjMTgxODFBIi8+PHBhdGggZD0iTTUgOEg5IiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA1SDExIiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA5LjVIMTEiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
		name: 'Startale',
		rdns: 'com.startale',
		uuid: crypto.randomUUID(),
	} as const
}

/** Check if a miniapp is in the added list for this address. */
function isMiniAppAdded(address: string | undefined, miniappOrigin: string): boolean {
	if (!address) return false
	try {
		const storageKey = `miniapps-added:${address}`
		const addedApps = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]
		return addedApps.includes(miniappOrigin)
	} catch {
		return false
	}
}

/** Add a miniapp to the list for this address. */
function addMiniAppToStorage(address: string | undefined, miniappOrigin: string) {
	if (!address) return
	try {
		const storageKey = `miniapps-added:${address}`
		const addedApps = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]
		if (!addedApps.includes(miniappOrigin)) {
			addedApps.push(miniappOrigin)
			localStorage.setItem(storageKey, JSON.stringify(addedApps))
		}
	} catch {
		console.error('[HOST] Failed to save miniapp added state')
	}
}

/** Create the initial Farcaster host context sent to the miniapp. */
function createHostContext(address?: string, miniappOrigin?: string) {
	const seed = address ?? 'george'
	const added = isMiniAppAdded(address, miniappOrigin || '')
	return {
		user: { fid: 3, username: "George", displayName: undefined, pfpUrl: `https://robohash.org/${seed}?size=200x200` },
		location: { type: 'launcher' as const },
		client: {
			platformType: 'web' as const,
			clientFid: 1,
			added,
			safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
		},
		features: {
			haptics: false,
			cameraAndMicrophoneAccess: Boolean(navigator.mediaDevices?.getUserMedia),
		},
		startale:{
			starPoints: 100,
		}
	}
}

/** Create helpers for posting messages to the miniapp iframe. */
function createMessagePoster(iframeWindow: Window, targetOrigin: string) {
	return {
		postFrameEvent: (event: unknown) => {
			iframeWindow.postMessage({ type: 'frameEvent', event }, targetOrigin)
		},
		postEthProviderEvent: (event: string, params: unknown[]) => {
			iframeWindow.postMessage(
				{ type: 'frameEthProviderEvent', event, params },
				targetOrigin,
			)
		},
	}
}

/** Fetch the webhookUrl from a miniapp's farcaster.json manifest (via API proxy to avoid CORS). */
async function getManifestWebhookUrl(targetOrigin: string) {
	try {
		const manifest = await fetch(`/api/miniapp-manifest?origin=${encodeURIComponent(targetOrigin)}`).then(r => r.json())
		console.log('[HOST] getManifestWebhookUrl - manifest:', manifest)
		// Try both "frame" and "miniapp" keys for compatibility
		const config = manifest as { frame?: { webhookUrl?: string }; miniapp?: { webhookUrl?: string } }
		const webhookUrl = config?.frame?.webhookUrl || config?.miniapp?.webhookUrl
		console.log('[HOST] getManifestWebhookUrl - found:', webhookUrl)
		return webhookUrl
	} catch (e) {
		console.error('[HOST] getManifestWebhookUrl error:', e)
	}
	return undefined
}

/** Build the Comlink host object that gets exposed to the miniapp iframe. */
function buildHostObject({
	chain,
	hostActions,
	handleEip1193Request,
	address,
	miniappOrigin,
}: {
	chain: typeof soneium
	hostActions: Record<string, unknown>
	handleEip1193Request: (method: string, params: unknown[] | undefined) => Promise<unknown>
	address?: string
	miniappOrigin?: string
}): Record<string, unknown> {
	return {
		context: createHostContext(address, miniappOrigin),

		getCapabilities: () =>
			Promise.resolve([
				'wallet.getEthereumProvider',
				'actions.addMiniApp',
				'actions.ready',
				'actions.openUrl',
				'actions.close',
			]),
		getChains: () => Promise.resolve([`eip155:${chain.id}`]),

		ethProviderRequest: async (request: unknown) => {
			const record = request as Record<string, unknown> | null
			const method = (record?.method as string | undefined) ?? undefined
			const params = (record?.params as unknown[] | undefined) ?? []
			if (!method) throw new ProviderRpcError(32_602, 'Missing method')
			return await handleEip1193Request(method, params)
		},

		ethProviderRequestV2: async (request: unknown) => {
			const record = request as Record<string, unknown> | null
			const id = record?.id as unknown
			const method = (record?.method as string | undefined) ?? undefined
			const params = (record?.params as unknown[] | undefined) ?? []
			if (!method) {
				return { jsonrpc: '2.0', id, error: { code: 32_602, message: 'Missing method' } }
			}
			try {
				const result = await handleEip1193Request(method, params)
				return { jsonrpc: '2.0', id, result }
			} catch (e) {
				const err = e instanceof ProviderRpcError
					? e
					: new ProviderRpcError(4001, e instanceof Error ? e.message : 'Error')
				return {
					jsonrpc: '2.0', id,
					error: { code: err.code, message: err.message, details: err.details },
				}
			}
		},

		...hostActions,
	}
}

// ============================================================================
// Component
// ============================================================================

export function FarcasterMiniappHost({
	src,
	title,
	onClose,
}: {
	src: string
	title?: string
	onClose?: () => void
}) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null)
	const { address } = useAccount()
	const publicClient = usePublicClient()
	const { data: walletClient } = useWalletClient()

	const chain = soneium
	const targetUrl = useMemo(() => safeParseUrl(src), [src])
	const targetOrigin = targetUrl?.origin

	const isAllowed = useMemo(() => {
		if (!targetOrigin) return false
		const hostOrigin =
			typeof window !== 'undefined' ? window.location.origin : null
		if (hostOrigin && targetOrigin === hostOrigin) return true
		return MINIAPP_ALLOWED_ORIGINS.has(targetOrigin)
	}, [targetOrigin])

	const handleEip1193Request = useCallback(
		async (method: string, params: unknown[] | undefined) => {
			switch (method) {
				case 'wallet_switchEthereumChain': {
					const p0 = params?.[0] as Record<string, unknown> | undefined
					const chainIdHex = typeof p0?.chainId === 'string' ? p0.chainId : undefined
					if (
						chainIdHex &&
						chainIdHex.toLowerCase() === `0x${chain.id.toString(16)}`.toLowerCase()
					) {
						return null
					}
					throw new ProviderRpcError(
						4200,
						'Startale currently supports Soneium only (cannot switch chains from a Mini App).',
					)
				}
				case 'wallet_addEthereumChain': {
					const p0 = params?.[0] as Record<string, unknown> | undefined
					const chainIdHex = typeof p0?.chainId === 'string' ? p0.chainId : undefined
					if (
						chainIdHex &&
						chainIdHex.toLowerCase() === `0x${chain.id.toString(16)}`.toLowerCase()
					) {
						return null
					}
					throw new ProviderRpcError(
						4200,
						'Startale currently supports Soneium only (cannot add/switch chains from a Mini App).',
					)
				}
				case 'eth_chainId':
					return `0x${chain.id.toString(16)}`
				case 'eth_accounts':
				case 'eth_requestAccounts':
					return address ? [address] : []
				case 'personal_sign': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const p0 = params?.[0]
					const p1 = params?.[1]
					const isAddress = (v: unknown) =>
						typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v.trim())
					const message =
						isAddress(p0) && typeof p1 === 'string'
							? p1
							: typeof p0 === 'string'
								? p0
								: ''

					return await walletClient.signMessage({
						message: message.startsWith('0x')
							? { raw: message as `0x${string}` }
							: message,
					})
				}
				case 'eth_signTypedData_v4': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const raw = params?.[1]
					const typedData =
						typeof raw === 'string' ? JSON.parse(raw) : raw

					return await walletClient.signTypedData(typedData)
				}
				case 'eth_sendTransaction': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const tx = params?.[0] as
						| { from?: string; to?: string; data?: string; value?: string }
						| undefined

					if (!tx?.to) throw new ProviderRpcError(32_602, 'Missing to')

					const hash = await walletClient.sendTransaction({
						to: tx.to as `0x${string}`,
						data: (tx.data as `0x${string}` | undefined) ?? undefined,
						value: tx.value ? BigInt(tx.value) : 0n,
						chain,
					})

					const client =
						publicClient ??
						createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })

					const receipt = await client.waitForTransactionReceipt({ hash })
					if (receipt.status === 'reverted') {
						throw new ProviderRpcError(4001, 'Transaction reverted')
					}
					return hash
				}
				default: {
					if (
						method.startsWith('wallet_') ||
						method.startsWith('personal_')
					) {
						throw new ProviderRpcError(4200, `Unsupported method: ${method}`)
					}
					try {
						const client =
							publicClient ??
							createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })
						return await client.request({
							method: method as never,
							params: (params ?? []) as never,
						})
					} catch {
						throw new ProviderRpcError(4200, `Unsupported method: ${method}`)
					}
				}
			}
		},
		[address, walletClient, chain, publicClient],
	)

	// Helper: Create host action handlers (defined inside component because it uses onClose)
	const createHostActions = useCallback((
		targetOrigin: string,
		postFrameEvent: (event: unknown) => void,
		providerInfo: ReturnType<typeof createProviderInfo>,
	) => {
		const addMiniAppImpl = async () => {
			try {
				// Persist that this miniapp is added for this user
				addMiniAppToStorage(address, targetOrigin)

				const webhookUrl = await getManifestWebhookUrl(targetOrigin)
				console.log('[HOST] addMiniApp - targetOrigin:', targetOrigin, 'webhookUrl:', webhookUrl)

				const details = { url: NOTIFICATION_SEND_URL, token: crypto.randomUUID() }
				const webhookPayload = {
					event: 'miniapp_added',
					userAddress: address ?? '0x0000000000000000000000000000000000000000',
					notificationDetails: details,
					miniappOrigin: targetOrigin,
				}

				postFrameEvent({ event: 'miniapp_added', notificationDetails: details })

				fetch(WEBHOOK_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': NOTIFICATIONS_API_KEY,
					},
					body: JSON.stringify(webhookPayload),
				}).catch((err) => console.error('[HOST] webhook error:', err))

				if (webhookUrl) {
					console.log('[HOST] Sending miniapp webhook to:', webhookUrl)
					fetch(webhookUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(webhookPayload),
					}).then(r => {
						console.log('[HOST] Miniapp webhook response:', r.status)
					}).catch((err) => console.error('[HOST] Miniapp webhook error:', err))
				} else {
					console.log('[HOST] No webhookUrl found in manifest')
				}

				return { result: { notificationDetails: details } }
			} catch (error) {
				console.error('[HOST] addMiniApp error:', error)
				throw error
			}
		}

		return {
			addMiniApp: addMiniAppImpl,
			addFrame: addMiniAppImpl,
			ready: () => {},
			close: () => onClose?.(),
			openUrl: (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),
			signIn: () => Promise.resolve({ error: { type: 'rejected_by_user' } }),
			signManifest: () => Promise.resolve({ error: { type: 'rejected_by_user' } }),
			viewCast: () => {},
			viewProfile: () => {},
			openMiniApp: () => {},
			composeCast: () => ({ cast: null }),
			viewToken: () => {},
			sendToken: () => Promise.resolve({
				success: false, reason: 'send_failed',
				error: { error: 'not_supported', message: 'Not supported in sandbox' },
			}),
			swapToken: () => Promise.resolve({
				success: false, reason: 'swap_failed',
				error: { error: 'not_supported', message: 'Not supported in sandbox' },
			}),
			requestCameraAndMicrophoneAccess: () => Promise.resolve(),
			impactOccurred: () => undefined,
			notificationOccurred: () => undefined,
			selectionChanged: () => undefined,
			eip6963RequestProvider: () => {
				postFrameEvent({ event: 'eip6963:announceProvider', info: providerInfo })
			},
		}
	}, [address, onClose])

	// ============================================================================
	// Iframe Communication Setup
	// ============================================================================

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe || !targetOrigin || !isAllowed) return

		let disposed = false
		let disposeEndpoint: (() => void) | null = null
		let timeoutId: ReturnType<typeof setTimeout> | null = null

		// Called when the iframe finishes loading its src.
		// Before load, contentWindow is at about:blank (parent origin),
		// so postMessage with the miniapp's targetOrigin would fail.
		const onIframeLoad = () => {
			if (disposed) return

			const iframeWindow = iframe.contentWindow
			if (!iframeWindow) return

			const { endpoint, dispose } = createSecureIframeEndpoint({ iframeWindow, targetOrigin })
			disposeEndpoint = dispose

			const providerInfo = createProviderInfo()
			const { postFrameEvent, postEthProviderEvent } = createMessagePoster(iframeWindow, targetOrigin)
			const hostActions = createHostActions(targetOrigin, postFrameEvent, providerInfo)
			const host = buildHostObject({ chain, hostActions, handleEip1193Request, address, miniappOrigin: targetOrigin })

			expose(host, endpoint)

			postFrameEvent({ event: 'eip6963:announceProvider', info: providerInfo })

			timeoutId = setTimeout(() => {
				if (disposed) return
				postEthProviderEvent('chainChanged', [`0x${chain.id.toString(16)}`])
				postEthProviderEvent('accountsChanged', [address ? [address] : []])
				if (address) {
					postEthProviderEvent('connect', [{ chainId: `0x${chain.id.toString(16)}` }])
				}
			}, 500)
		}

		iframe.addEventListener('load', onIframeLoad)

		return () => {
			disposed = true
			iframe.removeEventListener('load', onIframeLoad)
			if (timeoutId) clearTimeout(timeoutId)
			disposeEndpoint?.()
		}
	}, [address, chain, createHostActions, handleEip1193Request, isAllowed, targetOrigin])

	// ============================================================================
	// Render
	// ============================================================================

	if (!targetUrl) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
					Invalid Mini App URL
				</div>
			</div>
		)
	}

	if (!isAllowed) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
					Mini App origin is not allowed:{' '}
					<span className="font-mono">{targetOrigin}</span>
				</div>
			</div>
		)
	}

	return (
		<div className="flex w-full items-start justify-center px-4 py-6">
			<div className="flex w-full max-w-[424px] flex-col rounded-2xl border border-zinc-200 bg-white" style={{ height: '695px' }}>
				{/* Header bar */}
				<div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold text-sm text-zinc-950">
							{title ?? targetUrl.host}
						</p>
					</div>
					<button
						aria-label="Close"
						className="ml-3 inline-flex size-8 items-center justify-center rounded-full hover:bg-zinc-100"
						onClick={onClose}
						type="button"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Iframe container */}
				<div className="flex-1 overflow-hidden bg-white">
					<iframe
						allow="clipboard-read; clipboard-write"
						className="h-full w-full"
						ref={iframeRef}
						sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
						src={src}
						title={title ?? 'Mini App'}
					/>
				</div>
			</div>
		</div>
	)
}
