import {
	type Wallet,
	connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { startaleConnector } from "@startale/app-sdk";
import { http, createConnector } from "wagmi";
import { soneium } from "viem/chains";
import { createConfig } from "wagmi";
// Uncomment to add MetaMask wallet
// import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";

const WC_PROJECT_ID = "62ebdbceb8d541ed6f404b405b7657aa";

const startaleWallet = (): Wallet => ({
	id: "startale",
	name: "Startale App",
	iconUrl: "https://startale.com/image/symbol.png",
	iconBackground: "#8b5cf6",
	createConnector: (walletDetails) => {
		const connector = startaleConnector({
			appName: "MiniApp Sandbox",
			appLogoUrl: "https://startale.com/image/symbol.png",
			preference: {
				eoaAuthOnly: true,
				appChainIds: [soneium.id],
			},
		});
		return createConnector((config) => ({
			...connector(config),
			...walletDetails,
		}));
	},
});

const connectors = connectorsForWallets(
	[
		{
			groupName: "Recommended",
			wallets: [
				startaleWallet,
				// Uncomment to add MetaMask:
				// metaMaskWallet,
			],
		},
	],
	{
		appName: "MiniApp Sandbox",
		projectId: WC_PROJECT_ID,
	},
);

export const wagmiConfig = createConfig({
	connectors,
	chains: [soneium],
	transports: {
		[soneium.id]: http(),
	},
});
