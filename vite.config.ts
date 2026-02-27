import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { MINIAPP_ALLOWED_ORIGINS } from "./src/pages/configMiniApps";

/** Vite dev-server middleware that proxies manifest fetches to miniapp origins. */
function miniappManifestProxy(): Plugin {
	return {
		name: "miniapp-manifest-proxy",
		configureServer(server) {
			server.middlewares.use("/api/miniapp-manifest", async (req, res) => {
				const url = new URL(req.url ?? "", "http://localhost");
				const origin = url.searchParams.get("origin");

				if (!origin || !MINIAPP_ALLOWED_ORIGINS.has(origin)) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "Invalid or disallowed origin" }));
					return;
				}

				try {
					const manifestUrl = `${origin}/.well-known/farcaster.json`;
					const response = await fetch(manifestUrl);
					if (!response.ok) {
						res.writeHead(response.status);
						res.end();
						return;
					}
					const data = await response.json();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(data));
				} catch {
					res.writeHead(502, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "Failed to fetch manifest" }));
				}
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), miniappManifestProxy()],
	resolve: {
		alias: {
			"~": resolve(__dirname, "src"),
		},
	},
	server: {
		// Proxy Startale API requests to bypass browser CORS restrictions.
		proxy: {
			"/api/startale-proxy": {
				target: "https://app.startale.com",
				changeOrigin: true,
				rewrite: (path) => path.replace("/api/startale-proxy", ""),
			},
		},
	},
});
