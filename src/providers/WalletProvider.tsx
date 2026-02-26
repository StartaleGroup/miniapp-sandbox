import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "~/lib/wagmi";

const queryClient = new QueryClient();

const DYNAMIC_ENVIRONMENT_ID = import.meta.env.VITE_DYNAMIC_TEST_ENVIRONMENT_ID as string;

console.log("[WalletProvider] DYNAMIC_ENVIRONMENT_ID:", DYNAMIC_ENVIRONMENT_ID ?? "MISSING!");

fetch(`https://app.dynamicauth.com/api/v0/environments/${DYNAMIC_ENVIRONMENT_ID}`, {
	headers: { Accept: "application/json" },
})
	.then((r) => console.log("[WalletProvider] Dynamic API reachable — HTTP", r.status))
	.catch((e) => console.error("[WalletProvider] Dynamic API unreachable:", e.message));

interface WalletProviderProps {
	children: ReactNode;
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
	return (
		<DynamicContextProvider
			settings={{
				appName: "MiniApp Sandbox",
				environmentId: DYNAMIC_ENVIRONMENT_ID,
				walletConnectors: [EthereumWalletConnectors],
				events: {
					onAuthSuccess: (args) => console.log("[Dynamic] onAuthSuccess:", args),
					onAuthFailure: (err, connector) => console.error("[Dynamic] onAuthFailure:", err, connector),
				},
			}}
		>
			<WagmiProvider config={wagmiConfig}>
				<QueryClientProvider client={queryClient}>
					<DynamicWagmiConnector>
						{children}
					</DynamicWagmiConnector>
				</QueryClientProvider>
			</WagmiProvider>
		</DynamicContextProvider>
	);
};
