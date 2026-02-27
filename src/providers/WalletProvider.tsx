import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "~/lib/wagmi";

const queryClient = new QueryClient();

const DYNAMIC_ENVIRONMENT_ID = import.meta.env.VITE_DYNAMIC_TEST_ENVIRONMENT_ID as string;

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
