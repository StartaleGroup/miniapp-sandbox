import "@rainbow-me/rainbowkit/styles.css";

import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { useEffect } from "react";

import { AuthGuard } from "~/components/AuthGuard";
import { Layout } from "~/components/Layout";
import { wagmiConfig } from "~/lib/wagmi";
import { LoginPage } from "~/pages/LoginPage";
import { MiniAppsPage } from "~/pages/MiniAppsPage";

const queryClient = new QueryClient();

// Hide non-Startale wallets from RainbowKit modal
const useHideOtherWallets = () => {
	useEffect(() => {
		const hideWallets = () => {
			// Hide any wallet that's not Startale App
			const walletButtons = document.querySelectorAll(
				'div[data-rk] button[data-testid^="rk-wallet-option"]',
			);
			walletButtons.forEach((button) => {
				const buttonElement = button as HTMLElement;
				const text = buttonElement.textContent || "";
				// Only show "Startale App", hide everything else
				if (!text.includes("Startale App")) {
					buttonElement.style.display = "none";
				}
			});

			// Hide section headers that contain "Installed"
			const allElements = document.querySelectorAll('div[data-rk] *');
			allElements.forEach((el) => {
				const element = el as HTMLElement;
				if (element.textContent?.trim() === "Installed") {
					element.style.display = "none";
					// Also hide the wallet container after the "Installed" heading
					const nextSibling = element.nextElementSibling as HTMLElement;
					if (nextSibling) {
						nextSibling.style.display = "none";
					}
				}
			});

			// Hide "What is a Wallet?" section
			const learnLinks = document.querySelectorAll(
				'div[data-rk] a[href*="learn"]',
			);
			learnLinks.forEach((link) => {
				const parent = (link as HTMLElement).closest("div");
				if (parent) parent.style.display = "none";
			});
		};

		// Run immediately and on DOM changes
		const observer = new MutationObserver(hideWallets);
		observer.observe(document.body, { childList: true, subtree: true });
		hideWallets();

		return () => observer.disconnect();
	}, []);
};

export const App = () => {
	useHideOtherWallets();

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
				>
					<BrowserRouter>
						<Routes>
							<Route element={<Layout />}>
								<Route element={<LoginPage />} index />
								<Route element={<AuthGuard />}>
									<Route element={<MiniAppsPage />} path="miniapps" />
								</Route>
							</Route>
						</Routes>
					</BrowserRouter>
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
};
