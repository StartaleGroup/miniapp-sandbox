# Farcaster Mini App + Startale SDK — Developer Guide

A short guide to creating a new Farcaster Mini App and wiring it to use Startale’s wallet/SDK instead of the default Farcaster wallet.

---

## Overview

**You can build the app entirely using Farcaster’s official flow first, then switch the wallet layer to Startale.**

1. Use [Farcaster’s official docs](https://miniapps.farcaster.xyz) to create, build, and sign your Mini App (manifest, embed, SDK, etc.).
2. After the app runs correctly in a Farcaster client, add a single **wagmi config file** that uses **Startale’s connector** instead of the Farcaster miniapp connector. Your app stays a valid Farcaster Mini App; only the wallet/provider used inside the iframe is Startale.

This guide assumes you already have a Farcaster Mini App (or are about to create one) and want it to use Startale SDK for wallet/auth.

---

## 1. Build and sign the app (Farcaster)

Follow the official Farcaster Mini Apps documentation:

- **Docs:** [miniapps.farcaster.xyz](https://miniapps.farcaster.xyz/docs)
- **Getting started:** Use the [Quick Start](https://miniapps.farcaster.xyz/docs/getting-started) (e.g. `pnpm create @farcaster/mini-app`) or manual setup with `@farcaster/miniapp-sdk`.
- **Manifest:** Create and host `/.well-known/farcaster.json` with the required `miniapp` (or `frame`) object and, when ready, sign it.
- **Sign the manifest:** Use the [Farcaster manifest tool](https://farcaster.xyz/~/developers/mini-apps/manifest) — enter your **hostname only** (e.g. `my-miniapp.vercel.app`, no `https://` or path). The tool gives you a signed **account association** to put back into your manifest.
- **Embed:** Add the `fc:miniapp` meta tag in your HTML per the [spec](https://miniapps.farcaster.xyz/docs/specification#mini-app-embed).
- **SDK:** Call `await sdk.actions.ready()` after load so the splash screen is hidden.

Do not rely on this guide for manifest schema, embed schema, or signing steps — use the official Farcaster documentation for those.

---

## 2. Account association (after signing)

Once the manifest is signed:

- The **accountAssociation** object in `/.well-known/farcaster.json` contains `header`, `payload`, and `signature` (base64).
- It proves that a specific Farcaster account (custody or auth key) attests to the **domain** where the manifest is hosted.
- The `payload` decodes to `{ "domain": "<your-fqdn>" }`. The domain must match the host where the manifest is served (e.g. `my-miniapp.vercel.app`) exactly, including subdomains.
- Clients use this to show “who published this app” and to trust the manifest. No need to change this when switching to Startale; the app remains a normal Farcaster Mini App.

---

## 3. Add wagmi with Startale SDK

To use Startale for wallet/EVM interactions instead of the default Farcaster wallet:

1. **Install** (if not already present):
   - `wagmi`, `viem`, `@tanstack/react-query`
   - **Startale:** `@startale/app-sdk`
   - Keep `@farcaster/miniapp-sdk` for Farcaster-specific APIs (e.g. `sdk.actions.ready()`, context).

2. **Create a single wagmi config file** (e.g. `src/wagmi.ts`) that uses **only** the Startale connector and the chain(s) you need (e.g. Soneium):

```ts
// src/wagmi.ts
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

3. **Wrap the app with `WagmiProvider`** (and `QueryClientProvider` if you use React Query), using this config, in your root (e.g. `main.tsx`):

```tsx
import { WagmiProvider } from "wagmi";
import { config } from "./wagmi";

// ...
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</WagmiProvider>
```

4. **Remove or replace** the Farcaster miniapp wagmi connector (`@farcaster/miniapp-wagmi-connector`) from this config so that all wallet usage in the Mini App goes through Startale. The Farcaster client still loads your app and handles the frame; only the in-app wallet is Startale.

**Reference:** See an existing app that already uses Startale in wagmi, e.g. `inking-farcaster-miniapp-/src/wagmi.ts`, for the exact pattern and dependencies.

---

## 4. Use Startale SDK directly

To use Startale SDK for wallet/EVM interactions instead of the default Farcaster wallet:

1. **Install** (if not already present):
   - **Startale:** `@startale/app-sdk`
   - `viem` (optional)
   - Keep `@farcaster/miniapp-sdk` for Farcaster-specific APIs (e.g. `sdk.actions.ready()`, context).

2. **Import dependencies**

```ts
import { createStartaleAccountSDK } from "@startale/app-sdk";
import { toHex } from "viem";
```

3. **Create Startale SDK instance and connect to Startale App**

```ts
const sdk = createStartaleAccountSDK({
  appName: "Mini App Demo", // TODO: Replace with your app name
  appLogoUrl: "https://startale.com/image/symbol.png", // TODO: Replace with your app logo URL
  appChainIds: [1868], //Soneium chain ID
});

const provider = sdk.getProvider();

const accounts = await provider.request({ method: "eth_requestAccounts" });
```

4. **Sign message**

```ts
const response = await provider.request({
  method: "personal_sign",
  params: [toHex("Hello"), accounts[0]],
});
```

The similar approach can be used to send a transaction.

---

## Summary

| Step | Action                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Build and sign the Mini App using [Farcaster’s official documentation](https://miniapps.farcaster.xyz).                                                                                      |
| 2    | After signing, the manifest’s **accountAssociation** proves domain ownership to a Farcaster account; no change needed when adding Startale.                                                  |
| 3    | Add one **wagmi config** that uses **Startale’s connector** (and your chain, e.g. Soneium); wrap the app with `WagmiProvider`; remove the Farcaster miniapp wagmi connector from the config. |
| 4    | Optionally use SDK directly, without `wagmi`                                                                                                                                                 |

Result: a standard Farcaster Mini App that uses Startale SDK for wallet and chain interactions inside the app.