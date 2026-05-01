export interface MiniAppConfig {
	url: string
}

export const MINI_APPS: MiniAppConfig[] = [
	{ url: 'https://leafy-biscotti-4e9fc8.netlify.app/' },
	{ url: 'https://mini.weadredflag.org/' },

	// Add your Mini App here:
	// { url: 'https://your-miniapp.example.com/' },
]

/** Origins allowed for manifest fetch (API proxy). Derived from MINI_APPS urls. */
export const MINIAPP_ALLOWED_ORIGINS = new Set(
	MINI_APPS.map((app) => new URL(app.url).origin),
)
