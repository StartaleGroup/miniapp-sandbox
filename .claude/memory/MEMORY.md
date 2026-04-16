# Project Memory

## Project Structure

### 1. **miniapp-sandbox** (port 3100)
- Farcaster client/host implementation (`FarcasterMiniappHost.tsx`)
- Provides sandbox environment for testing miniapps locally
- Implements the Farcaster SDK host API including wallet, notifications, and frame interactions
- Uses Comlink over postMessage for secure iframe communication

### 2. **Notification server**
- communicates with Notification server (Firebase)
- ask Startale team to provide API_KEY


## Key Patterns

### Notification Flow
1. MiniApp calls `sdk.actions.addMiniApp()` → receives token + notification URL
2. Sandbox sends webhook to notify with token
3. MiniApp persists token in backend
4. MiniApp sends notifications using the token
5. Sanbox is polling notifications from notification server on regular interval

## Documentation

**Farcaster MiniApps Official Docs**: Located at `./docs/farcaster-docs.txt`
- Comprehensive guide to Farcaster MiniApp development
- 47k+ tokens covering SDK, Quick Auth, notifications, wallet integration
- Reference this file for Farcaster-specific questions

## Tech Stack
- Farcaster SDK (`@farcaster/miniapp-sdk`)
- Vite + React (miniapps)
- Comlink (postMessage abstraction)
- wagmi + viem (wallet integration)
