# Project Memory

## Project Structure

This workspace contains three main projects for Farcaster MiniApp development:

### 1. **miniapp-sandbox** (port 3100)
- Farcaster client/host implementation (`FarcasterMiniappHost.tsx`)
- Provides sandbox environment for testing miniapps locally
- Implements the Farcaster SDK host API including wallet, notifications, and frame interactions
- Uses Comlink over postMessage for secure iframe communication

### 2. **meymar** (port 3200)
- Localhost notification server for Farcaster MiniApps
- Handles webhook events, stores notification tokens in SQLite
- Provides APIs to send notifications back to miniapps
- SSE stream for real-time notification updates in sandbox UI

### 3. **inking-farcaster-miniapp** (port 5173)
- Example Farcaster miniapp
- Demonstrates notifications with localStorage persistence
- Uses Farcaster SDK to interact with host

## Key Patterns

### Notification Flow
1. MiniApp calls `sdk.actions.addMiniApp()` → receives token + notification URL
2. Sandbox sends webhook to meymar with token
3. MiniApp persists token in localStorage (no re-enabling needed)
4. MiniApp sends notifications using the token
5. Meymar validates and broadcasts via SSE

### File Naming
- `meymar` - notification server (not "notification-server")

## Documentation

**Farcaster MiniApps Official Docs**: Located at `.farcaster-docs.txt`
- Comprehensive guide to Farcaster MiniApp development
- 47k+ tokens covering SDK, Quick Auth, notifications, wallet integration
- Reference this file for Farcaster-specific questions

## Tech Stack
- Farcaster SDK (`@farcaster/miniapp-sdk`)
- Hono (meymar server)
- Vite + React (miniapps)
- better-sqlite3 (requires native build - use `enable-pre-post-scripts=true` in .npmrc)
- Comlink (postMessage abstraction)
- wagmi + viem (wallet integration)
