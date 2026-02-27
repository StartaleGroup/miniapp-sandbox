import { Copy, LogOut } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import appLogo from "~/icons/app-logo-purple.svg";

/** Top bar with page title, wallet address, and disconnect button. */
export const Header = () => {
	const { isConnected, address } = useAccount();
	const { disconnect } = useDisconnect();
	const { pathname } = useLocation();
	const [copied, setCopied] = useState(false);

	const title: Record<string, string> = {
		"/": "Home",
		"/miniapps": "MiniApps",
	};

	const handleCopyAddress = async () => {
		if (address) {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
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
				{isConnected && address && (
					<>
						{/* Address with copy button */}
						<div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2">
							<span className="font-mono text-sm text-zinc-900">
								{address}
							</span>
							<button
								className="flex cursor-pointer items-center"
								onClick={handleCopyAddress}
								title={copied ? "Copied!" : "Copy address"}
								type="button"
							>
								<Copy className="size-4 text-zinc-600 hover:text-zinc-900" />
							</button>
						</div>
						{/* Disconnect button */}
						<button
							className="flex cursor-pointer items-center gap-1 rounded-full bg-violet-600 px-3 py-2 transition-colors hover:bg-violet-700"
							onClick={() => disconnect()}
							type="button"
						>
							<LogOut className="size-4 text-white" />
							<span className="font-medium text-sm text-white">
								Disconnect
							</span>
						</button>
					</>
				)}
			</div>
		</div>
	);
};
