import { startaleConnector } from "@startale/app-sdk";
import { http, createConfig } from "wagmi";
import { soneium } from "viem/chains";

export const wagmiConfig = createConfig({
	connectors: [
		startaleConnector({
			appName: "MiniApp Sandbox",
			appLogoUrl: "https://startale.com/image/symbol.png",
			preference: {
				eoaAuthOnly: true,
				appChainIds: [soneium.id],
			},
		}),
	],
	chains: [soneium],
	transports: {
		[soneium.id]: http(),
	},
});
