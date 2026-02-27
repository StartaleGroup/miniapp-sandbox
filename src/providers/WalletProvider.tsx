import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import type { ReactNode } from "react";

import { wagmiConfig } from "~/lib/wagmi";

const queryClient = new QueryClient();

interface WalletProviderProps {
	children: ReactNode;
}

/** Provides wallet connection via wagmi. */
export const WalletProvider = ({ children }: WalletProviderProps) => {
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</WagmiProvider>
	);
};
