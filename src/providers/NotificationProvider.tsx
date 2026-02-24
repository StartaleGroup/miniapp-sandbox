import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react'

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

const NOTIFY_EVENTS_URL = 'http://localhost:3200/events'

// Cache for manifest iconUrl (null means "looked up, not found")
const manifestCache = new Map<string, string | null>()

// Fetch iconUrl from manifest via API proxy to avoid CORS issues
async function enrichNotificationWithIcon(notification: Notification): Promise<Notification> {
	try {
		const url = new URL(notification.targetUrl)
		const origin = url.origin

		// Check cache first (includes negative results)
		if (manifestCache.has(origin)) {
			const cached = manifestCache.get(origin)
			return cached ? { ...notification, iconUrl: cached } : notification
		}

		// Fetch manifest via API proxy (same pattern as MiniAppsPage)
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
		manifestCache.set(origin, null)
	}

	return notification
}

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [unreadCount, setUnreadCount] = useState(0)
	const eventSourceRef = useRef<EventSource | null>(null)

	useEffect(() => {
		const es = new EventSource(NOTIFY_EVENTS_URL)
		eventSourceRef.current = es

		es.addEventListener('notification', (e) => {
			try {
				const data = JSON.parse(e.data) as Notification
				// Enrich notification with iconUrl from manifest
				enrichNotificationWithIcon(data).then((enrichedData) => {
					setNotifications((prev) => [enrichedData, ...prev])
					setUnreadCount((prev) => prev + 1)
				})
			} catch {
				// Ignore malformed events
			}
		})

		es.onerror = () => {
			// EventSource auto-reconnects; nothing to do
		}

		return () => {
			es.close()
			eventSourceRef.current = null
		}
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
