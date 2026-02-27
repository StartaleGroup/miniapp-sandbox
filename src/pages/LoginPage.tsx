import { Navigate } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
import appLogo from "~/icons/app-logo-purple.svg";

/** Prompts wallet connection, redirects to miniapps when connected. */
export const LoginPage = () => {
	const { isConnected } = useAccount();
	const { connect, connectors, isPending } = useConnect();

	if (isConnected) {
		return <Navigate replace to="/miniapps" />;
	}

	const startaleConnector = connectors[0];

	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="flex flex-col items-center gap-8">
				<div className="flex flex-col items-center gap-4">
					<img alt="MiniApps Sandbox" className="h-20 w-20" src={appLogo} />
					<h2 className="text-violet-600">MiniApps Sandbox</h2>
				</div>
				<button
					type="button"
					disabled={isPending}
					onClick={() => connect({ connector: startaleConnector })}
					className="rounded-xl bg-violet-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
				>
					{isPending ? "Connecting…" : "Connect Wallet"}
				</button>
			</div>
		</div>
	);
};
