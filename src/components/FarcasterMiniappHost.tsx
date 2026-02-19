/**
 * FarcasterMiniappHost - Farcaster MiniApp Client/Host Implementation
 *
 * Implements the Farcaster client/host side of the MiniApp protocol.
 * Hosts miniapps in an iframe and provides the Farcaster SDK host API
 * including wallet access, notifications, and frame interactions.
 */
import { expose } from 'comlink'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { soneium } from 'viem/chains'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { createSecureIframeEndpoint } from '~/lib/miniapps/farcaster-comlink'
import { MINIAPP_ALLOWED_ORIGINS } from '~/pages/configMiniApps'


class ProviderRpcError extends Error {
	code: number
	details?: string
	constructor(code: number, message: string, details?: string) {
		super(message)
		this.code = code
		this.details = details
	}
}

type PendingApproval = {
	title: string
	description?: string
	resolve: () => void
	reject: (e: Error) => void
} | null

function safeParseUrl(raw: string): URL | null {
	try {
		return new URL(raw)
	} catch {
		return null
	}
}

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

	const [pendingApproval, setPendingApproval] = useState<PendingApproval>(null)

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

	const waitForApproval = useCallback(
		(approvalTitle: string, description?: string) => {
			return new Promise<void>((resolve, reject) => {
				setPendingApproval({ title: approvalTitle, description, resolve, reject })
			})
		},
		[],
	)

	const approve = useCallback(() => {
		pendingApproval?.resolve()
		setPendingApproval(null)
	}, [pendingApproval])

	const reject = useCallback(() => {
		pendingApproval?.reject(new Error('User rejected request'))
		setPendingApproval(null)
	}, [pendingApproval])

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

					await waitForApproval('Sign message', message || 'Sign a message for this Mini App.')

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

					await waitForApproval(
						'Sign typed data',
						typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2),
					)

					return await walletClient.signTypedData(typedData)
				}
				case 'eth_sendTransaction': {
					if (!address || !walletClient)
						throw new ProviderRpcError(4001, 'Wallet not connected')

					const tx = params?.[0] as
						| { from?: string; to?: string; data?: string; value?: string }
						| undefined

					if (!tx?.to) throw new ProviderRpcError(32_602, 'Missing to')

					await waitForApproval(
						'Approve transaction',
						JSON.stringify(tx, null, 2),
					)

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
		[address, walletClient, chain, publicClient, waitForApproval],
	)

	// ============================================================================
	// Helper Functions
	// ============================================================================

	// Helper: Create EIP-6963 provider info
	const createProviderInfo = () => ({
		icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjMTgxODFBIi8+PHBhdGggZD0iTTUgOEg5IiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA1SDExIiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNSA5LjVIMTEiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
		name: 'Startale',
		rdns: 'com.startale',
		uuid: crypto.randomUUID(),
	} as const)

	// The host's notification service - always the same regardless of miniapp
	const NOTIFICATION_SERVER_URL = 'http://localhost:3200/api/miniapps-notifications'
	const MEYMAR_WEBHOOK_URL = 'http://localhost:3200/webhook'

	// Helper: Get miniapp's webhookUrl from its manifest
	const getManifestWebhookUrl = async (targetOrigin: string) => {
		try {
			const manifest = await fetch(`${targetOrigin}/.well-known/farcaster.json`).then(r => r.json())
			return (manifest as { miniapp?: { webhookUrl?: string } })?.miniapp?.webhookUrl
		} catch { /* manifest fetch failed */ }
		return undefined
	}

	// Helper: Create message posting utilities
	const createMessagePoster = (iframeWindow: Window, targetOrigin: string) => ({
		postFrameEvent: (event: unknown) => {
			iframeWindow.postMessage({ type: 'frameEvent', event }, targetOrigin)
		},
		postEthProviderEvent: (event: string, params: unknown[]) => {
			iframeWindow.postMessage(
				{ type: 'frameEthProviderEvent', event, params },
				targetOrigin,
			)
		},
	})

	// Helper: Create host context object
	const createHostContext = () => ({
		user: {
			fid: 3,
			username: undefined,
			displayName: undefined,
			pfpUrl: undefined,
		},
		location: {
			type: 'launcher' as const,
		},
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
		starPoints: 100,
	})

	// Helper: Create host action handlers
	const createHostActions = (
		targetOrigin: string,
		postFrameEvent: (event: unknown) => void,
		providerInfo: ReturnType<typeof createProviderInfo>,
	) => {
		// Shared implementation for addMiniApp/addFrame
		const addMiniAppImpl = async () => {
			try {
				const webhookUrl = await getManifestWebhookUrl(targetOrigin)
				// Notification URL always points to the host's notification service
				const details = { url: NOTIFICATION_SERVER_URL, token: crypto.randomUUID() }
				const webhookPayload = { event: 'miniapp_added', notificationDetails: details }

				postFrameEvent({ event: 'miniapp_added', notificationDetails: details })

				// Always register the token with the host's notification store
				fetch(MEYMAR_WEBHOOK_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(webhookPayload),
				}).catch((err) => {
					console.error('[HOST] webhook error:', err)
				})

				// Also forward webhook to the miniapp's own backend
				if (webhookUrl) {
					fetch(webhookUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(webhookPayload),
					}).catch((err) => {
						console.error('[HOST] Miniapp webhook error:', err)
					})
				}

				return { result: { notificationDetails: details } }
			} catch (error) {
				console.error('[HOST] addMiniApp error:', error)
				throw error
			}
		};

		return {
			// Miniapp lifecycle actions
			addMiniApp: addMiniAppImpl,
			addFrame: addMiniAppImpl, // Backwards compatibility - SDK still calls this

			// Navigation actions
			ready: () => {},
			close: () => onClose?.(),
			openUrl: (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),

		// Signing actions (not supported in sandbox)
		signIn: () => Promise.resolve({ error: { type: 'rejected_by_user' } }),
		signManifest: () => Promise.resolve({ error: { type: 'rejected_by_user' } }),

		// Social actions (no-ops in sandbox)
		viewCast: () => {},
		viewProfile: () => {},
		openMiniApp: () => {},
		composeCast: () => ({ cast: null }),
		viewToken: () => {},

		// Token actions (not supported)
		sendToken: () => Promise.resolve({
			success: false,
			reason: 'send_failed',
			error: { error: 'not_supported', message: 'Not supported in sandbox' },
		}),
		swapToken: () => Promise.resolve({
			success: false,
			reason: 'swap_failed',
			error: { error: 'not_supported', message: 'Not supported in sandbox' },
		}),

		// Permissions
		requestCameraAndMicrophoneAccess: () => Promise.resolve(),

		// Haptics (no-ops)
		impactOccurred: () => undefined,
		notificationOccurred: () => undefined,
		selectionChanged: () => undefined,

		// EIP-6963
		eip6963RequestProvider: () => {
			postFrameEvent({
				event: 'eip6963:announceProvider',
				info: providerInfo,
			})
		},
		};
	};

	useEffect(() => {
		const iframeWindow = iframeRef.current?.contentWindow
		if (!iframeWindow) return
		if (!targetOrigin) return
		if (!isAllowed) return

		const { endpoint, dispose } = createSecureIframeEndpoint({
			iframeWindow,
			targetOrigin,
		})

		// Create utilities and data
		const providerInfo = createProviderInfo()
		const { postFrameEvent, postEthProviderEvent } = createMessagePoster(iframeWindow, targetOrigin)
		const hostActions = createHostActions(targetOrigin, postFrameEvent, providerInfo)

		// Build complete host object with context, capabilities, and actions
		const host: Record<string, unknown> = {
			context: createHostContext(),

			getCapabilities: () =>
				Promise.resolve([
					'wallet.getEthereumProvider',
					'actions.addMiniApp',
					'actions.ready',
					'actions.openUrl',
					'actions.close',
				]),
			getChains: () => Promise.resolve([`eip155:${chain.id}`]),

			// Ethereum provider methods
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
					return {
						jsonrpc: '2.0',
						id,
						error: { code: 32_602, message: 'Missing method' },
					}
				}
				try {
					const result = await handleEip1193Request(method, params)
					return { jsonrpc: '2.0', id, result }
				} catch (e) {
					const err =
						e instanceof ProviderRpcError
							? e
							: new ProviderRpcError(
									4001,
									e instanceof Error ? e.message : 'Error',
								)
					return {
						jsonrpc: '2.0',
						id,
						error: {
							code: err.code,
							message: err.message,
							details: err.details,
						},
					}
				}
			},

			// All other actions from helper
			...hostActions,
		}

		expose(host, endpoint)

		// Announce the provider via EIP-6963 immediately
		postFrameEvent({
			event: 'eip6963:announceProvider',
			info: providerInfo,
		})

		// Give the miniapp SDK a moment to set up its listeners before emitting initial state
		const timeoutId = setTimeout(() => {
			postEthProviderEvent('chainChanged', [
				`0x${chain.id.toString(16)}`,
			])
			postEthProviderEvent('accountsChanged', [
				address ? [address] : [],
			])
			if (address) {
				postEthProviderEvent('connect', [
					{ chainId: `0x${chain.id.toString(16)}` },
				])
			}
		}, 500)

		return () => {
			clearTimeout(timeoutId)
			dispose()
		}
	}, [
		address,
		chain,
		handleEip1193Request,
		isAllowed,
		onClose,
		targetOrigin,
	])

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

			{/* Approval dialog */}
			{pendingApproval && (
				<div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
					<div className="w-full max-w-md rounded-2xl bg-white p-8">
						<h2 className="text-center font-semibold text-2xl text-zinc-950">
							{pendingApproval.title}
						</h2>
						<p className="mt-2 text-center text-sm text-zinc-500">
							Review and approve this request from the Mini App.
						</p>
						{pendingApproval.description && (
							<div className="mt-4 max-h-56 overflow-auto rounded-xl bg-zinc-50 p-4">
								<pre className="whitespace-pre-wrap break-all text-sm text-zinc-900">
									{pendingApproval.description}
								</pre>
							</div>
						)}
						<div className="mt-6 flex gap-4">
							<button
								className="h-12 flex-1 rounded-full border border-zinc-200 bg-white font-medium text-zinc-900 hover:bg-zinc-50"
								onClick={reject}
								type="button"
							>
								Cancel
							</button>
							<button
								className="h-12 flex-1 rounded-full bg-violet-600 font-medium text-white hover:bg-violet-700"
								onClick={approve}
								type="button"
							>
								Approve
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
