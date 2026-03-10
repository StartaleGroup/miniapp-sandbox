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
import { logFarcaster, logNotify } from '~/lib/logger'
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

const NOTIFICATION_SERVER_URL = 'http://localhost:3200/api/miniapps-notifications'
const NOTIFY_WEBHOOK_URL = 'http://localhost:3200/webhook'

/** Create EIP-6963 provider metadata. */
function createProviderInfo() {
	return {
		icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjMTgxODFBIi8+PHBhdGggZD0iTTUgOEg5IiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA1SDExIiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA5LjVIMTEiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
		name: 'Startale',
		rdns: 'com.startale',
		uuid: crypto.randomUUID(),
	} as const
}

/** Create the initial Farcaster host context sent to the miniapp. */
function createHostContext(address: string | undefined) {
	const seed = address ?? 'george'
	return {
		user: { fid: 3, username: "George", displayName: undefined, pfpUrl: `https://robohash.org/${seed}?size=200x200` },
		location: { type: 'launcher' as const },
		client: {
			platformType: 'web' as const,
			clientFid: 1,
			added: false,
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
			logFarcaster('→ postMessage frameEvent', event)
			iframeWindow.postMessage({ type: 'frameEvent', event }, targetOrigin)
		},
		postEthProviderEvent: (event: string, params: unknown[]) => {
			logFarcaster('→ postMessage ethProviderEvent', { event, params })
			iframeWindow.postMessage(
				{ type: 'frameEthProviderEvent', event, params },
				targetOrigin,
			)
		},
	}
}

/** Fetch the webhookUrl from a miniapp's farcaster.json manifest. */
async function getManifestWebhookUrl(targetOrigin: string) {
	try {
		logNotify('fetching manifest', `${targetOrigin}/.well-known/farcaster.json`)
		const manifest = await fetch(`${targetOrigin}/.well-known/farcaster.json`).then(r => r.json())
		const miniappConfig = manifest as { miniapp?: { webhookUrl?: string } }
		const webhookUrl = miniappConfig?.miniapp?.webhookUrl
		logNotify('manifest webhookUrl', webhookUrl ?? '(none)')
		return webhookUrl
	} catch (err) {
		logNotify('manifest fetch failed', err)
	}
	return undefined
}

/** Build the Comlink host object that gets exposed to the miniapp iframe. */
function buildHostObject({
	chain,
	hostActions,
	handleEip1193Request,
}: {
	chain: typeof soneium
	hostActions: Record<string, unknown>
	handleEip1193Request: (method: string, params: unknown[] | undefined) => Promise<unknown>
}): Record<string, unknown> {
	return {
		context: createHostContext(),

		getCapabilities: () => {
			logFarcaster('← getCapabilities', '(called by miniapp)')
			const caps = [
				'wallet.getEthereumProvider',
				'actions.addMiniApp',
				'actions.ready',
				'actions.openUrl',
				'actions.close',
			]
			logFarcaster('→ getCapabilities', caps)
			return Promise.resolve(caps)
		},

		getChains: () => {
			const chains = [`eip155:${chain.id}`]
			logFarcaster('← getChains', chains)
			return Promise.resolve(chains)
		},

		ethProviderRequest: async (request: unknown) => {
			const record = request as Record<string, unknown> | null
			const method = (record?.method as string | undefined) ?? undefined
			const params = (record?.params as unknown[] | undefined) ?? []
			logFarcaster('← ethProviderRequest', { method, params })
			if (!method) throw new ProviderRpcError(32_602, 'Missing method')
			const result = await handleEip1193Request(method, params)
			logFarcaster('→ ethProviderRequest', { method, result })
			return result
		},

		ethProviderRequestV2: async (request: unknown) => {
			const record = request as Record<string, unknown> | null
			const id = record?.id as unknown
			const method = (record?.method as string | undefined) ?? undefined
			const params = (record?.params as unknown[] | undefined) ?? []
			logFarcaster('← ethProviderRequestV2', { id, method, params })
			if (!method) {
				const errResponse = { jsonrpc: '2.0', id, error: { code: 32_602, message: 'Missing method' } }
				logFarcaster('→ ethProviderRequestV2 error', errResponse)
				return errResponse
			}
			try {
				const result = await handleEip1193Request(method, params)
				logFarcaster('→ ethProviderRequestV2', { id, method, result })
				return { jsonrpc: '2.0', id, result }
			} catch (e) {
				const err = e instanceof ProviderRpcError
					? e
					: new ProviderRpcError(4001, e instanceof Error ? e.message : 'Error')
				const errResponse = {
					jsonrpc: '2.0', id,
					error: { code: err.code, message: err.message, details: err.details },
				}
				logFarcaster('→ ethProviderRequestV2 error', errResponse)
				return errResponse
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
			logFarcaster('EIP-1193 request', { method, params })
			switch (method) {
				case 'wallet_switchEthereumChain': {
					const p0 = params?.[0] as Record<string, unknown> | undefined
					const chainIdHex = typeof p0?.chainId === 'string' ? p0.chainId : undefined
					if (
						chainIdHex &&
						chainIdHex.toLowerCase() === `0x${chain.id.toString(16)}`.toLowerCase()
					) {
						logFarcaster('wallet_switchEthereumChain', `already on chain ${chain.id} — ok`)
						return null
					}
					logFarcaster('wallet_switchEthereumChain', `rejected: only Soneium (${chain.id}) supported`)
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
						logFarcaster('wallet_addEthereumChain', `Soneium already supported — ok`)
						return null
					}
					logFarcaster('wallet_addEthereumChain', `rejected: only Soneium supported`)
					throw new ProviderRpcError(
						4200,
						'Startale currently supports Soneium only (cannot add/switch chains from a Mini App).',
					)
				}
				case 'eth_chainId': {
					const chainId = `0x${chain.id.toString(16)}`
					logFarcaster('eth_chainId', chainId)
					return chainId
				}
				case 'eth_accounts':
				case 'eth_requestAccounts': {
					const accounts = address ? [address] : []
					logFarcaster(method, accounts)
					return accounts
				}
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

					logFarcaster('personal_sign', { message: message.slice(0, 80), address })
					const sig = await walletClient.signMessage({
						message: message.startsWith('0x')
							? { raw: message as `0x${string}` }
							: message,
					})
					logFarcaster('personal_sign result', sig.slice(0, 20) + '…')
					return sig
				}
				case 'eth_signTypedData_v4': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const raw = params?.[1]
					const typedData = typeof raw === 'string' ? JSON.parse(raw) : raw
					logFarcaster('eth_signTypedData_v4', { address, typedData })
					const sig = await walletClient.signTypedData(typedData)
					logFarcaster('eth_signTypedData_v4 result', sig.slice(0, 20) + '…')
					return sig
				}
				case 'eth_sendTransaction': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const tx = params?.[0] as
						| { from?: string; to?: string; data?: string; value?: string }
						| undefined

					if (!tx?.to) throw new ProviderRpcError(32_602, 'Missing to')

					logFarcaster('eth_sendTransaction', tx)
					const hash = await walletClient.sendTransaction({
						to: tx.to as `0x${string}`,
						data: (tx.data as `0x${string}` | undefined) ?? undefined,
						value: tx.value ? BigInt(tx.value) : 0n,
						chain,
					})
					logFarcaster('eth_sendTransaction hash', hash)

					const client =
						publicClient ??
						createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })

					const receipt = await client.waitForTransactionReceipt({ hash })
					logFarcaster('eth_sendTransaction receipt', { status: receipt.status, hash })
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
						logFarcaster(`${method}`, 'unsupported — rejected')
						throw new ProviderRpcError(4200, `Unsupported method: ${method}`)
					}
					try {
						logFarcaster(`${method}`, 'forwarding to public client')
						const client =
							publicClient ??
							createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })
						const result = await client.request({
							method: method as never,
							params: (params ?? []) as never,
						})
						logFarcaster(`${method} result`, result)
						return result
					} catch {
						logFarcaster(`${method}`, 'public client failed — unsupported')
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
			logFarcaster('← addMiniApp', `origin=${targetOrigin}`)
			try {
				const webhookUrl = await getManifestWebhookUrl(targetOrigin)
				const details = { url: NOTIFICATION_SERVER_URL, token: crypto.randomUUID() }
				const webhookPayload = { event: 'miniapp_added', notificationDetails: details, miniappOrigin: targetOrigin }

				logFarcaster('addMiniApp: notificationDetails', details)
				logFarcaster('addMiniApp: postFrameEvent', { event: 'miniapp_added', notificationDetails: details })
				postFrameEvent({ event: 'miniapp_added', notificationDetails: details })

				logNotify(`→ POST ${NOTIFY_WEBHOOK_URL}`, webhookPayload)
				fetch(NOTIFY_WEBHOOK_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(webhookPayload),
				})
					.then(r => logNotify(`← notify webhook response`, `HTTP ${r.status}`))
					.catch((err) => logNotify('notify webhook error', err))

				if (webhookUrl) {
					logNotify(`→ POST miniapp webhook ${webhookUrl}`, webhookPayload)
					fetch(webhookUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(webhookPayload),
					})
						.then(r => logNotify(`← miniapp webhook response`, `HTTP ${r.status}`))
						.catch((err) => logNotify('miniapp webhook error', err))
				} else {
					logNotify('miniapp webhook', 'no webhookUrl in manifest — skipped')
				}

				const result = { result: { notificationDetails: details } }
				logFarcaster('→ addMiniApp result', result)
				return result
			} catch (error) {
				logFarcaster('addMiniApp error', error)
				throw error
			}
		}

		return {
			addMiniApp: addMiniAppImpl,
			addFrame: addMiniAppImpl,
			ready: () => {
				logFarcaster('← ready', `origin=${targetOrigin}`)
			},
			close: () => {
				logFarcaster('← close', `origin=${targetOrigin}`)
				onClose?.()
			},
			openUrl: (url: string) => {
				logFarcaster('← openUrl', url)
				window.open(url, '_blank', 'noopener,noreferrer')
			},
			signIn: () => {
				logFarcaster('← signIn', 'rejected_by_user')
				return Promise.resolve({ error: { type: 'rejected_by_user' } })
			},
			signManifest: () => {
				logFarcaster('← signManifest', 'rejected_by_user')
				return Promise.resolve({ error: { type: 'rejected_by_user' } })
			},
			viewCast: () => { logFarcaster('← viewCast', '(noop)') },
			viewProfile: () => { logFarcaster('← viewProfile', '(noop)') },
			openMiniApp: () => { logFarcaster('← openMiniApp', '(noop)') },
			composeCast: () => {
				logFarcaster('← composeCast', '(noop)')
				return ({ cast: null })
			},
			viewToken: () => { logFarcaster('← viewToken', '(noop)') },
			sendToken: () => {
				logFarcaster('← sendToken', 'not_supported')
				return Promise.resolve({
					success: false, reason: 'send_failed',
					error: { error: 'not_supported', message: 'Not supported in sandbox' },
				})
			},
			swapToken: () => {
				logFarcaster('← swapToken', 'not_supported')
				return Promise.resolve({
					success: false, reason: 'swap_failed',
					error: { error: 'not_supported', message: 'Not supported in sandbox' },
				})
			},
			requestCameraAndMicrophoneAccess: () => {
				logFarcaster('← requestCameraAndMicrophoneAccess', '(delegating to browser)')
				return Promise.resolve()
			},
			impactOccurred: () => { logFarcaster('← impactOccurred', '(haptics noop)') },
			notificationOccurred: () => { logFarcaster('← notificationOccurred', '(haptics noop)') },
			selectionChanged: () => { logFarcaster('← selectionChanged', '(haptics noop)') },
			eip6963RequestProvider: () => {
				logFarcaster('← eip6963RequestProvider', 'announcing provider')
				postFrameEvent({ event: 'eip6963:announceProvider', info: providerInfo })
			},
		}
	}, [onClose])

	// ============================================================================
	// Iframe Communication Setup
	// ============================================================================

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe || !targetOrigin || !isAllowed) return

		logFarcaster('host init', `src=${src} origin=${targetOrigin}`)

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

			logFarcaster('iframe loaded', `src=${src}`)

			const { endpoint, dispose } = createSecureIframeEndpoint({ iframeWindow, targetOrigin })
			disposeEndpoint = dispose

			const providerInfo = createProviderInfo()
			logFarcaster('provider info', { name: providerInfo.name, rdns: providerInfo.rdns })

			const { postFrameEvent, postEthProviderEvent } = createMessagePoster(iframeWindow, targetOrigin)
			const hostActions = createHostActions(targetOrigin, postFrameEvent, providerInfo)
			const host = buildHostObject({ chain, hostActions, handleEip1193Request })

			expose(host, endpoint)
			logFarcaster('comlink host exposed', 'ready for miniapp calls')

			logFarcaster('→ eip6963:announceProvider', providerInfo.name)
			postFrameEvent({ event: 'eip6963:announceProvider', info: providerInfo })

			timeoutId = setTimeout(() => {
				if (disposed) return
				const chainIdHex = `0x${chain.id.toString(16)}`
				logFarcaster('→ chainChanged', chainIdHex)
				postEthProviderEvent('chainChanged', [chainIdHex])
				logFarcaster('→ accountsChanged', address ? [address] : [])
				postEthProviderEvent('accountsChanged', [address ? [address] : []])
				if (address) {
					logFarcaster('→ connect', { chainId: chainIdHex })
					postEthProviderEvent('connect', [{ chainId: chainIdHex }])
				}
			}, 500)
		}

		iframe.addEventListener('load', onIframeLoad)

		return () => {
			disposed = true
			logFarcaster('host teardown', `origin=${targetOrigin}`)
			iframe.removeEventListener('load', onIframeLoad)
			if (timeoutId) clearTimeout(timeoutId)
			disposeEndpoint?.()
		}
	}, [address, chain, createHostActions, handleEip1193Request, isAllowed, src, targetOrigin])

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
