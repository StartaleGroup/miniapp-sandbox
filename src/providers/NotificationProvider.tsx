import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import { NOTIFICATIONS_API_KEY, NOTIFICATIONS_POLL_URL } from '~/lib/notifications-config'

export interface Notification {
	notificationId: string
	title: string
	body: string
	targetUrl: string
	timestamp: string
	iconUrl?: string
}

interface NotificationContextValue {
	notifications: Notification[]
	unreadCount: number
	markAllRead: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
	notifications: [],
	unreadCount: 0,
	markAllRead: () => {},
})

export const useNotifications = () => useContext(NotificationContext)

const POLL_INTERVAL_MS = 3000

// Cache for manifest iconUrl (null means "looked up, not found")
const manifestCache = new Map<string, string | null>()

/** Enrich a notification with its miniapp icon from the farcaster.json manifest. */
async function enrichNotificationWithIcon(notification: Notification): Promise<Notification> {
	let origin: string | undefined
	try {
		origin = new URL(notification.targetUrl).origin

		// Check cache first (includes negative results)
		if (manifestCache.has(origin)) {
			const cached = manifestCache.get(origin)
			return cached ? { ...notification, iconUrl: cached } : notification
		}

		// Fetch manifest via API proxy
		const res = await fetch(`/api/miniapp-manifest?origin=${encodeURIComponent(origin)}`)
		if (!res.ok) {
			manifestCache.set(origin, null)
			return notification
		}
		const manifest = await res.json() as { miniapp?: { iconUrl?: string } }
		const iconUrl = manifest?.miniapp?.iconUrl ?? null

		manifestCache.set(origin, iconUrl)
		return iconUrl ? { ...notification, iconUrl } : notification
	} catch {
		if (origin) manifestCache.set(origin, null)
	}

	return notification
}

/** Provides notification state by polling the Firebase sent notifications endpoint. */
export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [unreadCount, setUnreadCount] = useState(0)
	const seenIdsRef = useRef(new Set<string>())
	const lastPollTimeRef = useRef(new Date().toISOString())

	useEffect(() => {
		const poll = async () => {
			try {
				const url = `${NOTIFICATIONS_POLL_URL}?since=${encodeURIComponent(lastPollTimeRef.current)}`
				console.log('[notifications] polling sent, url:', url, 'key:', NOTIFICATIONS_API_KEY.slice(0, 6) + '…')
				const res = await fetch(url, {
					headers: { 'x-api-key': NOTIFICATIONS_API_KEY },
				})
				if (!res.ok) return

				const data = (await res.json()) as {
					notifications: {
						notificationId: string
						title: string
						body: string
						targetUrl: string
						createdAt: string
					}[]
				}

				if (data.notifications.length === 0) return

				for (const n of data.notifications) {
					if (seenIdsRef.current.has(n.notificationId)) continue
					seenIdsRef.current.add(n.notificationId)

					const enriched = await enrichNotificationWithIcon({
						notificationId: n.notificationId,
						title: n.title,
						body: n.body,
						targetUrl: n.targetUrl,
						timestamp: n.createdAt,
					})
					setNotifications((prev) => [enriched, ...prev])
					setUnreadCount((prev) => prev + 1)
				}

				lastPollTimeRef.current = new Date().toISOString()
			} catch {
				// Poll failed — will retry next interval
			}
		}

		const intervalId = setInterval(poll, POLL_INTERVAL_MS)
		return () => clearInterval(intervalId)
	}, [])

	const markAllRead = useCallback(() => {
		setUnreadCount(0)
	}, [])

	return (
		<NotificationContext.Provider
			value={{ notifications, unreadCount, markAllRead }}
		>
			{children}
		</NotificationContext.Provider>
	)
}
