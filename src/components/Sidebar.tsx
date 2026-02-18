import { Blocks } from "lucide-react";
import { NavLink } from "react-router-dom";
import appLogo from "~/icons/app-logo-purple.svg";
import { cn } from "~/lib/utils";
import { useAccount } from "wagmi";
import { NotificationBell } from "./NotificationPanel";

export const Sidebar = () => {
	const { isConnected } = useAccount();

	return (
		<aside className="hidden lg:block">
			<div className="flex h-full w-64 flex-col border-zinc-200 border-r bg-white py-5">
				{/* Header */}
				<div className="px-6 pb-6">
					<NavLink className="flex items-center gap-3" to="/">
						<img alt="MiniApps Sandbox logo" className="h-10 w-10" src={appLogo} />
						<span className="whitespace-nowrap font-semibold text-lg text-violet-600">
							MiniApps Sandbox
						</span>
					</NavLink>
				</div>

				{/* Navigation */}
				<div className="flex-1 px-2">
					<div className="space-y-1.5">
						<NavLink
							className={({ isActive }) =>
								cn(
									"flex items-center rounded-full px-4 py-2.5 font-medium text-base",
									!isConnected
										? "pointer-events-none text-zinc-400"
										: isActive
											? "bg-zinc-100 text-zinc-950"
											: "text-zinc-950 hover:bg-zinc-100",
								)
							}
							to="/miniapps"
						>
							<Blocks className="mr-2 size-5" />
							MiniApps
						</NavLink>
						<NotificationBell />
					</div>
				</div>

			</div>
		</aside>
	);
};
