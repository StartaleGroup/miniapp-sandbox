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
		id: 'inking',
		name: 'Inking',
		description: 'Demo minting App',
		url: 'https://inking-farcaster-miniapp.vercel.app/',
		imageUrl: 'https://inking-farcaster-miniapp.vercel.app/preview.png',
		category: 'NFT',
		tags: ['minting', 'collectibles', 'demo'],
	},
]

/** Origins allowed for manifest fetch (API proxy). Derived from MINI_APPS urls. */
export const MINIAPP_ALLOWED_ORIGINS = new Set(
	MINI_APPS.map((app) => new URL(app.url).origin),
)