import { useEffect, useState } from 'react'
import { FarcasterMiniappHost } from '~/components/FarcasterMiniappHost'
import { MINI_APPS, type MiniAppConfig } from './configMiniApps'

interface FarcasterManifestMiniapp {
	description?: string
	primaryCategory?: string
	tags?: string[]
}

interface AppMeta {
	description: string | null
	category: string | null
	tags: string[]
}

/** Fetch manifest via superapp API proxy to avoid CORS. */
async function fetchAppMeta(app: MiniAppConfig): Promise<AppMeta> {
	try {
		const origin = new URL(app.url).origin
		const res = await fetch(
			`/api/miniapp-manifest?origin=${encodeURIComponent(origin)}`,
		)
		if (!res.ok) return { description: null, category: null, tags: [] }
		const data = (await res.json()) as { miniapp?: FarcasterManifestMiniapp }
		const miniapp = data.miniapp
		return {
			description: miniapp?.description ?? null,
			category: miniapp?.primaryCategory ?? null,
			tags: Array.isArray(miniapp?.tags) ? miniapp.tags : [],
		}
	} catch {
		return { description: null, category: null, tags: [] }
	}
}

export const MiniAppsPage = () => {
	const [metaByAppId, setMetaByAppId] = useState<Record<string, AppMeta>>({})
	const [activeMiniApp, setActiveMiniApp] = useState<MiniAppConfig | null>(null)

	useEffect(() => {
		let cancelled = false
		const run = async () => {
			const entries = await Promise.all(
				MINI_APPS.map(async (app) => {
					const meta = await fetchAppMeta(app)
					return [app.id, meta] as const
				})
			)
			if (cancelled) return
			setMetaByAppId(Object.fromEntries(entries))
		}
		run()
		return () => {
			cancelled = true
		}
	}, [])

	return (
		<>
			{!activeMiniApp ? (
				<div className="flex w-full flex-col gap-8 px-4 py-6 md:max-w-lg">
					<h1 className="font-semibold text-2xl text-zinc-950 leading-8">
						Mini Apps
					</h1>

					<div className="space-y-4">
						<p className="text-zinc-600">
							Discover and interact with mini apps
						</p>

						<div className="grid gap-4 md:grid-cols-2">
						{MINI_APPS.map((app) => {
							const meta = metaByAppId[app.id] ?? {
								description: null,
								category: null,
								tags: [],
							}
							const description = meta.description ?? app.description
							const category = meta.category ?? app.category
							const tags = meta.tags.length > 0 ? meta.tags : (app.tags ?? [])
							const hasCategoryOrTags = !!category || tags.length > 0
							return (
								<button
									key={app.id}
									onClick={() => setActiveMiniApp(app)}
									className="rounded-lg border border-zinc-200 p-4 text-left transition-all hover:border-violet-500 hover:shadow-md"
									type="button"
								>
									{app.imageUrl && (
										<div className="mb-3 h-32 w-full overflow-hidden rounded-md bg-zinc-100">
											<img
												src={app.imageUrl}
												alt={app.name}
												className="h-full w-full object-cover object-top"
											/>
										</div>
									)}
									<h3 className="mb-2 font-medium text-lg">{app.name}</h3>
									<p className="mb-2 text-sm text-zinc-600">{description}</p>
									{hasCategoryOrTags && (
										<div className="mb-2 flex flex-wrap items-center gap-2 text-zinc-500">
											{category && (
												<span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
													{category}
												</span>
											)}
											{tags.map((tag) => (
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
					key={activeMiniApp.url}
					src={activeMiniApp.url}
					title={activeMiniApp.name}
					onClose={() => setActiveMiniApp(null)}
				/>
			)}
		</>
	)
}
