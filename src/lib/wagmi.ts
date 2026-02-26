import { http } from "viem";
import { soneium } from "viem/chains";
import { createConfig } from "wagmi";

export const wagmiConfig = createConfig({
	chains: [soneium],
	multiInjectedProviderDiscovery: false,
	transports: {
		[soneium.id]: http(),
	},
});

declare module "wagmi" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: required
	interface Register {
		config: typeof wagmiConfig;
	}
}
