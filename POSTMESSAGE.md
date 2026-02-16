# postMessage Communication

## Overview

This sandbox uses **postMessage** to enable secure communication between the parent app and miniapp iframes, following the [Farcaster Mini Apps specification](https://miniapps.farcaster.xyz/docs/specification). We use [Comlink](https://github.com/GoogleChromeLabs/comlink) as a convenience layer on top of postMessage.

## Farcaster Protocol

According to the official Farcaster documentation:

> "This SDK facilitates communication over a `postMessage` channel available in iframes and mobile WebViews."

**Key points:**
- postMessage is the standard communication mechanism for Farcaster Mini Apps
- There is no formal specification for the message passing format
- Hosts should use packages from the [farcasterxyz/miniapps](https://github.com/farcasterxyz/miniapps) repo

## Why Comlink?

Comlink (1.6KB by Google Chrome Labs) makes postMessage communication simpler by:
- Automatically serializing function calls into postMessage events
- Handling async operations and Promises transparently
- Providing type-safe function calls across iframe boundaries

**Without Comlink:**
```javascript
// Parent
window.addEventListener('message', (event) => {
  if (event.data.method === 'eth_requestAccounts') {
    iframe.postMessage({ id: event.data.id, result: [address] }, origin)
  }
})

// Child
window.postMessage({ id: 1, method: 'eth_requestAccounts' }, '*')
```

**With Comlink:**
```javascript
// Parent
const host = {
  ethProviderRequest: async ({ method }) => {
    if (method === 'eth_requestAccounts') return [address]
  }
}
expose(host, endpoint)

// Child (via Farcaster SDK)
const accounts = await sdk.wallet.ethProviderRequest({
  method: 'eth_requestAccounts'
})
```

## Implementation

### Parent Side (Sandbox)

**File:** `src/components/MiniappFrame.tsx`

```typescript
import { expose } from 'comlink'
import { createSecureIframeEndpoint } from '~/lib/miniapps/farcaster-comlink'

// Create secure endpoint with origin validation
const { endpoint, dispose } = createSecureIframeEndpoint({
  iframeWindow,
  targetOrigin,
})

// Expose Farcaster host API
const host = {
  context: { user: {...}, client: {...} },
  ethProviderRequest: async (request) => { /* RPC handler */ },
  getChains: () => Promise.resolve(['eip155:1868']),
  // ... other Farcaster methods
}

expose(host, endpoint)

// Emit initial provider state after 500ms delay
setTimeout(() => {
  postEthProviderEvent('chainChanged', [`0x${chain.id.toString(16)}`])
  postEthProviderEvent('accountsChanged', [address ? [address] : []])
  if (address) {
    postEthProviderEvent('connect', [{ chainId: `0x${chain.id.toString(16)}` }])
  }
}, 500)
```

### Child Side (MiniApp)

The miniapp uses the Farcaster SDK, which connects via postMessage:

```typescript
import { sdk } from '@farcaster/miniapp-sdk'

// Farcaster SDK handles postMessage internally
const accounts = await sdk.wallet.ethProviderRequest({
  method: 'eth_requestAccounts'
})
```

## Security

**File:** `src/lib/miniapps/farcaster-comlink.ts`

Every message is validated:
- `event.source === iframeWindow` - Only the specific iframe
- `event.origin === targetOrigin` - Only allowed origins

Only URLs in `MINIAPP_ALLOWED_ORIGINS` (from `configMiniApps.ts`) can communicate.

## Communication Flow

```
┌─────────────┐                                    ┌──────────────┐
│   Parent    │                                    │   MiniApp    │
│  (Sandbox)  │                                    │   (iframe)   │
└─────────────┘                                    └──────────────┘
       │                                                   │
       │  expose(host) via Comlink over postMessage      │
       │─────────────────────────────────────────────────▶│
       │                                                   │
       │  emit provider events (chainChanged, etc)       │
       │─────────────────────────────────────────────────▶│
       │                                                   │
       │  ethProviderRequest('eth_requestAccounts')      │
       │◀─────────────────────────────────────────────────│
       │     (postMessage under the hood)                 │
       │                                                   │
       │  return [address]                               │
       │─────────────────────────────────────────────────▶│
```

## Why Not Raw postMessage?

Comlink is an **implementation choice**, not a requirement. The superapp uses it for convenience. Other valid approaches:
- Raw postMessage with manual message handling
- Custom message passing library
- Different abstraction layer

All work as long as they expose the expected Farcaster host API.

## Resources

- [Farcaster Mini Apps Docs](https://miniapps.farcaster.xyz)
- [Farcaster Specification](https://miniapps.farcaster.xyz/docs/specification)
- [Comlink GitHub](https://github.com/GoogleChromeLabs/comlink)
- [Farcaster SDK Source](https://github.com/farcasterxyz/miniapps)
