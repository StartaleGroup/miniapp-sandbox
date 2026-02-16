import "@rainbow-me/rainbowkit/styles.css";

import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import type { ReactNode } from "react";

import { wagmiConfig } from "~/lib/wagmi";

const queryClient = new QueryClient();

interface WalletProviderProps {
	children: ReactNode;
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider
					theme={lightTheme({
						accentColor: "#8b5cf6",
						accentColorForeground: "white",
						borderRadius: "medium",
					})}
					modalSize="compact"
					appInfo={{
						appName: "MiniApps Sandbox",
						learnMoreUrl: undefined,
					}}
				>
					{children}
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
};
