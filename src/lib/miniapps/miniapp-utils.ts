export function safeParseUrl(raw: string): URL | null {
	try {
		return new URL(raw)
	} catch {
		return null
	}
}
