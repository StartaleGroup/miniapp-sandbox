import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '~/providers/NotificationProvider'
import { useAccount } from 'wagmi'
import { cn } from '~/lib/utils'

export function NotificationBell() {
	const { notifications, unreadCount, markAllRead } = useNotifications()
	const { isConnected } = useAccount()
	const [open, setOpen] = useState(false)
	const panelRef = useRef<HTMLDivElement>(null)

	const toggle = () => {
		if (!open) {
			setOpen(true)
			markAllRead()
		} else {
			setOpen(false)
		}
	}

	// Close on outside click
	useEffect(() => {
		if (!open) return
		const handler = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open])

	return (
		<div className="relative" ref={panelRef}>
			<button
				className={cn(
					"relative flex items-center rounded-full px-4 py-2.5 font-medium text-base",
					!isConnected
						? "pointer-events-none text-zinc-400"
						: "text-zinc-950 hover:bg-zinc-100"
				)}
				onClick={toggle}
				type="button"
				disabled={!isConnected}
			>
				<Bell className="mr-2 size-5" />
				Notifications
				{unreadCount > 0 && isConnected && (
					<span className="absolute top-1.5 left-full -ml-3 flex size-5 items-center justify-center rounded-full bg-red-500 font-medium text-[10px] text-white">
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute top-full left-0 z-50 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg">
					<div className="border-b border-zinc-100 px-4 py-3">
						<p className="font-semibold text-sm text-zinc-950">
							Notifications
						</p>
					</div>
					<div className="max-h-80 overflow-auto">
						{notifications.length === 0 ? (
							<div className="px-4 py-8 text-center text-sm text-zinc-400">
								No notifications yet
							</div>
						) : (
							notifications.map((n, i) => (
								<div
									className="border-b border-zinc-50 px-4 py-3 last:border-b-0 hover:bg-zinc-50"
									key={`${n.notificationId}-${i}`}
								>
									<p className="font-medium text-sm text-zinc-950">
										{n.title}
									</p>
									<p className="mt-0.5 text-sm text-zinc-500">
										{n.body}
									</p>
									<p className="mt-1 text-xs text-zinc-400">
										{new Date(n.timestamp).toLocaleTimeString()}
									</p>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	)
}
