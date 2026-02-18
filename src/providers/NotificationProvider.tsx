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

const MEYMAR_EVENTS_URL = 'http://localhost:3200/events'

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [unreadCount, setUnreadCount] = useState(0)
	const eventSourceRef = useRef<EventSource | null>(null)

	useEffect(() => {
		const es = new EventSource(MEYMAR_EVENTS_URL)
		eventSourceRef.current = es

		es.addEventListener('notification', (e) => {
			try {
				const data = JSON.parse(e.data) as Notification
				setNotifications((prev) => [data, ...prev])
				setUnreadCount((prev) => prev + 1)
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
