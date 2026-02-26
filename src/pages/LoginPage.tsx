import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import appLogo from "~/icons/app-logo-purple.svg";

export const LoginPage = () => {
	const { isConnected, address, status } = useAccount();
	const { sdkHasLoaded } = useDynamicContext();

	useEffect(() => {
		console.log("[Login] wagmi:", { isConnected, address, status });
	}, [isConnected, address, status]);

	useEffect(() => {
		console.log("[Login] sdkHasLoaded:", sdkHasLoaded);
	}, [sdkHasLoaded]);

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
				<DynamicWidget />
			</div>
		</div>
	);
};
