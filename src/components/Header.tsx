import { LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import appLogo from "~/icons/app-logo-purple.svg";

export const Header = () => {
	const { isConnected } = useAccount();
	const { disconnect } = useDisconnect();
	const { pathname } = useLocation();

	const title: Record<string, string> = {
		"/": "Home",
		"/miniapps": "MiniApps",
	};

	return (
		<div className="flex h-14 items-center justify-between border-zinc-200 border-b px-4 py-2">
			{/* Left Section */}
			<div className="flex flex-1 items-center justify-start gap-2">
				<img
					alt="Logo"
					className="size-10 object-contain lg:hidden"
					src={appLogo}
				/>
			</div>

			{/* Center Section - Title */}
			<div className="flex-1 text-center">
				<h1 className="font-semibold text-base text-zinc-950 leading-none">
					{title[pathname] ?? "MiniApp Sandbox"}
				</h1>
			</div>

			{/* Right Section */}
			<div className="flex flex-1 items-center justify-end gap-2">
				{isConnected && (
					<button
						className="flex cursor-pointer items-center gap-1 rounded-full bg-zinc-100 px-3 py-2 transition-colors hover:bg-zinc-200"
						onClick={() => disconnect()}
						type="button"
					>
						<LogOut className="size-4 text-zinc-900" />
						<span className="font-medium text-sm text-zinc-900">
							Disconnect
						</span>
					</button>
				)}
			</div>
		</div>
	);
};
