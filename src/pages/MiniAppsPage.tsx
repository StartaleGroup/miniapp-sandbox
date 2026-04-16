import { useEffect, useState } from 'react'
import { FarcasterMiniappHost } from '~/components/FarcasterMiniappHost'
import { MINI_APPS, type MiniAppConfig } from './configMiniApps'

interface FarcasterManifestFrame {
	name?: string
	description?: string
	imageUrl?: string
	primaryCategory?: string
	tags?: string[]
}

interface ResolvedApp {
	url: string
	name: string
	description: string | null
	imageUrl: string | null
	category: string | null
	tags: string[]
}

/** Fetch miniapp metadata from the farcaster.json manifest. */
async function resolveApp(app: MiniAppConfig): Promise<ResolvedApp> {
	const fallback: ResolvedApp = {
		url: app.url,
		name: new URL(app.url).hostname,
		description: null,
		imageUrl: null,
		category: null,
		tags: [],
	}
	try {
		const origin = new URL(app.url).origin
		const res = await fetch(
			`/api/miniapp-manifest?origin=${encodeURIComponent(origin)}`,
		)
		if (!res.ok) return fallback
		const data = (await res.json()) as { frame?: FarcasterManifestFrame; miniapp?: FarcasterManifestFrame }
		const frame = data.frame ?? data.miniapp
		if (!frame) return fallback
		return {
			url: app.url,
			name: frame.name ?? fallback.name,
			description: frame.description ?? null,
			imageUrl: frame.imageUrl ?? null,
			category: frame.primaryCategory ?? null,
			tags: Array.isArray(frame.tags) ? frame.tags : [],
		}
	} catch {
		return fallback
	}
}

/** Displays available miniapps and hosts the selected one in an iframe. */
export const MiniAppsPage = () => {
	const [resolvedApps, setResolvedApps] = useState<ResolvedApp[]>([])
	const [activeApp, setActiveApp] = useState<ResolvedApp | null>(null)

	useEffect(() => {
		let cancelled = false
		const run = async () => {
			const apps = await Promise.all(MINI_APPS.map(resolveApp))
			if (cancelled) return
			setResolvedApps(apps)
		}
		run()
		return () => {
			cancelled = true
		}
	}, [])

	return (
		<>
			{!activeApp ? (
				<div className="flex w-full flex-col gap-8 px-4 py-6">

					<div className="space-y-4">

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
						{resolvedApps.map((app) => {
							const hasCategoryOrTags = !!app.category || app.tags.length > 0
							return (
								<button
									key={app.url}
									onClick={() => setActiveApp(app)}
									className="flex flex-col rounded-lg border border-zinc-200 p-4 text-left transition-all hover:border-violet-500 hover:shadow-md"
									type="button"
								>
									{app.imageUrl && (
										<div className="mb-3 aspect-[3/2] w-full overflow-hidden rounded-md bg-zinc-100">
											<img
												src={app.imageUrl}
												alt={app.name}
												className="h-full w-full object-cover"
											/>
										</div>
									)}
									<h3 className="mb-2 font-medium text-lg">{app.name}</h3>
									{app.description && (
										<p className="mb-2 text-sm text-zinc-600">{app.description}</p>
									)}
									{hasCategoryOrTags && (
										<div className="mb-2 flex flex-wrap items-center gap-2 text-zinc-500">
											{app.category && (
												<span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
													{app.category}
												</span>
											)}
											{app.tags.map((tag) => (
												<span
													key={tag}
													className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
												>
													#{tag}
												</span>
											))}
										</div>
									)}
									<p className="text-xs text-violet-600">
										Open →
									</p>
								</button>
							)
						})}
						</div>
					</div>
				</div>
			) : (
				<FarcasterMiniappHost
					key={activeApp.url}
					src={activeApp.url}
					title={activeApp.name}
					onClose={() => setActiveApp(null)}
				/>
			)}
		</>
	)
}
