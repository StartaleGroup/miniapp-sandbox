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

const manifestCache = new Map<string, string | null>()

/** Enrich a notification with the miniapp's icon from its Farcaster manifest. */
async function enrichNotificationWithIcon(notification: Notification): Promise<Notification> {
	let origin: string | undefined
	try {
		origin = new URL(notification.targetUrl).origin

		if (manifestCache.has(origin)) {
			const cached = manifestCache.get(origin)
			return cached ? { ...notification, iconUrl: cached } : notification
		}

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
				enrichNotificationWithIcon(data).then((enrichedData) => {
					setNotifications((prev) => [enrichedData, ...prev])
					setUnreadCount((prev) => prev + 1)
				})
			} catch {}
		})

		es.onerror = () => {}

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
