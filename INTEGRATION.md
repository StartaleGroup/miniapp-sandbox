# Farcaster Mini App + Startale SDK — Developer Guide

Build a Farcaster Mini App that uses Startale's wallet instead of the default Farcaster wallet.

---

## Overview

1. Build your Mini App using [Farcaster's official docs](https://miniapps.farcaster.xyz)
2. Add Startale's connector to your wagmi config (or use the SDK directly)
3. Your app stays a valid Farcaster Mini App — only the wallet layer changes

---

## 1. Build and sign the app

Follow the official Farcaster Mini Apps documentation:

- **Docs:** [miniapps.farcaster.xyz](https://miniapps.farcaster.xyz/docs)
- **Quick Start:** `pnpm create @farcaster/mini-app` or manual setup with `@farcaster/miniapp-sdk`
- **Manifest:** Create `/.well-known/farcaster.json` with the required `miniapp` object
- **Sign:** Use the [Farcaster manifest tool](https://farcaster.xyz/~/developers/mini-apps/manifest) — enter your hostname (e.g. `my-miniapp.vercel.app`, no `https://`)
- **Embed:** Add the `fc:miniapp` meta tag per the [spec](https://miniapps.farcaster.xyz/docs/specification#mini-app-embed)
- **SDK:** Call `await sdk.actions.ready()` after load

---

## 2. Add Startale SDK

You can use Startale in two ways: with wagmi or directly.

### Option A: With wagmi (Recommended)

**Install:**
```bash
pnpm add wagmi viem @tanstack/react-query @startale/app-sdk @farcaster/miniapp-sdk
```

**Create wagmi config (`src/wagmi.ts`):**
```ts
import { startaleConnector } from "@startale/app-sdk";
import { http, createConfig } from "wagmi";
import { soneium } from "wagmi/chains";

export const config = createConfig({
  chains: [soneium],
  connectors: [startaleConnector()],
  transports: {
    [soneium.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
```

**Wrap your app (`main.tsx`):**
```tsx
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { config } from "./wagmi";

const queryClient = new QueryClient();

<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</WagmiProvider>
```

**Use in components:**
```tsx
import { useAccount, useConnect, useSignMessage } from "wagmi";

function MyComponent() {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessage } = useSignMessage();

  return (
    <button onClick={() => connect({ connector: connectors[0] })}>
      Connect
    </button>
  );
}
```

### Option B: Direct SDK (No wagmi)

**Install:**
```bash
pnpm add @startale/app-sdk viem @farcaster/miniapp-sdk
```

**Use directly:**
```ts
import { createStartaleAccountSDK } from "@startale/app-sdk";
import { toHex } from "viem";

const sdk = createStartaleAccountSDK({
  appName: "My Mini App",
  appLogoUrl: "https://my-miniapp.com/logo.png",
  appChainIds: [1868], // Soneium
});

const provider = sdk.getProvider();
const accounts = await provider.request({ method: "eth_requestAccounts" });

// Sign message
const response = await provider.request({
  method: "personal_sign",
  params: [toHex("Hello"), accounts[0]],
});
```

---

## 3. Register your app in the Sandbox

Add your Mini App to `src/pages/configMiniApps.ts` so it appears in the sandbox launcher:

```ts
// src/pages/configMiniApps.ts
export const MINI_APPS: MiniAppConfig[] = [
  // ... existing apps ...
  {
    id: 'your-app-id',
    name: 'Your App Name',
    description: 'Short description of your app',
    url: 'http://localhost:5175/',          // local dev URL
    imageUrl: 'http://localhost:5175/preview.png', // preview image (3:2 ratio)
    category: 'DeFi',                       // optional: DeFi, NFT, Gaming, Social, etc.
    tags: ['swap', 'trading'],              // optional
  },
];
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (kebab-case) |
| `name` | Yes | Display name in the launcher |
| `description` | Yes | Short description shown on the app card |
| `url` | Yes | Your miniapp URL (localhost for dev, deployed URL for prod) |
| `imageUrl` | Yes | Preview image for the app card (3:2 aspect ratio) |
| `category` | No | Category badge (e.g. `NFT`, `DeFi`, `Gaming`) |
| `tags` | No | Tags shown on the app card |

The sandbox automatically reads your app's `/.well-known/farcaster.json` manifest to fetch the icon, description, and category. Values from the manifest override the static config above.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Build and sign using [Farcaster's docs](https://miniapps.farcaster.xyz) |
| 2 | Add Startale connector to wagmi config (or use SDK directly) |
| 3 | Register your app in `src/pages/configMiniApps.ts` |

Result: A Farcaster Mini App powered by Startale SDK, running in the sandbox.

---

**Reference:** See `inking-farcaster-miniapp/src/wagmi.ts` for a working example.
