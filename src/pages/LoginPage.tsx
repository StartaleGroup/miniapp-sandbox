import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import appLogo from "~/icons/app-logo-purple.svg";

/** Prompts wallet connection, redirects to miniapps when connected. */
export const LoginPage = () => {
	const { isConnected } = useAccount();

	if (isConnected) {
		return <Navigate replace to="/miniapps" />;
	}

	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="flex flex-col items-center gap-8">
				<div className="flex flex-col items-center gap-4">
					<img alt="MiniApps Sandbox" className="h-20 w-20" src={appLogo} />
					<h2 className="text-violet-600">MiniApps Sandbox</h2>
				</div>
				<p className="text-center">Connect your wallet to get started</p>
				<ConnectButton />
			</div>
		</div>
	);
};
