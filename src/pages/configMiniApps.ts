export interface MiniAppConfig {
	id: string
	name: string
	description: string
	url: string
	imageUrl: string
	category?: string
	tags?: string[]
}

export const MINI_APPS: MiniAppConfig[] = [
	{
		id: 'demo-mini-app',
		name: 'Demo Mini App',
		description: 'Demo notification',
		url: 'http://localhost:3000/',
		imageUrl: 'http://localhost:3000/preview.png',
		category: 'NFT',
		tags: ['minting', 'collectibles', 'demo'],
	},
	{
		id: 'coolcats',
		name: 'Cool Cats',
		description: 'Cool Cats - Cooltopia!',
		url: 'https://startale.coolcats.com/',
		imageUrl: 'https://startale.coolcats.com/og.png',
		category: 'Gaming',
		tags: ['collectibles'],
	},
	{
		id: 'nekocat-play',
		name: 'NekoCat Play',
		description: 'Collect, feed, and battle NekoCat NFTs. Mint, level up, and make them immortal.',
		url: 'https://play.nekocat.world',
		imageUrl: 'https://play.nekocat.world/nekocat-logo-transparent.webp',
		category: 'Gaming',
		tags: ['nft', 'gaming', 'collectibles', 'onchain'],
	},
	// Add your Mini App here:
	// {
	// 	id: 'your-app-id',
	// 	name: 'Your App Name',
	// 	description: 'Description of your app',
	// 	url: 'https://your-miniapp.example.com/',
	// 	imageUrl: 'https://your-miniapp.example.com/preview.png',
	// 	category: 'DeFi', // Optional: e.g., 'DeFi', 'NFT', 'Gaming', 'Social'
	// 	tags: ['tag1', 'tag2'], // Optional: e.g., ['swap', 'trading']
	// },
]

/** Origins allowed for manifest fetch (API proxy). Derived from MINI_APPS urls. */
export const MINIAPP_ALLOWED_ORIGINS = new Set(
	MINI_APPS.map((app) => new URL(app.url).origin),
)
