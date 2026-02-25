import { http } from "viem";
import { soneium } from "viem/chains";
import { createConfig, injected } from "wagmi";

export const wagmiConfig = createConfig({
	chains: [soneium],
	transports: {
		[soneium.id]: http(),
	},
	connectors: [injected()],
});

declare module "wagmi" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: required
	interface Register {
		config: typeof wagmiConfig;
	}
}
