<div align="center">
  <img src="public/favicon.svg" alt="MiniApps Sandbox Logo" width="120" height="120">
  <h1>MiniApps Sandbox</h1>
  <p>Development sandbox for third-party Farcaster Mini Apps integrating with Startale App</p>
</div>

---

## 📋 Overview

This sandbox demonstrates how to build and test Farcaster Mini Apps that integrate with **Startale App** for wallet authentication and Soneium interactions.

### Key Features

- 🔐 **Startale Wallet Authentication** - Connect using Startale App with smart contract wallet
- ⛓️ **Soneium Network** - Currently supports Soneium blockchain only
- 🔗 **Wagmi Integration** - Full interaction support via wagmi hooks
- 📱 **Mini Apps Gallery** - Browse and launch Mini Apps

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- A browser with wallet support (for testing)

### Quick Start - All Services

Use the provided script to start both the sandbox and notification service:

```bash
./start.sh
```

This starts both services in the background:
- **sandbox** at `http://localhost:3100` — the host/client UI
- **notify** at `http://localhost:3200` — notification service (token storage, SSE delivery)

To stop all services:
```bash
./stop.sh
```

### Manual Development

**Sandbox only:**
```bash
pnpm install
pnpm dev
```
The sandbox will be available at `http://localhost:3100`

**With notification service** (run in separate terminals):
```bash
# Terminal 1 - Sandbox
pnpm dev

# Terminal 2 - Notify service
cd notify
pnpm install
pnpm dev
```

---

### Add your Mini App

To add your Mini App to the sandbox, please follow the steps below:

1. Add your Mini App to the `src/pages/configMiniApps.ts` file

## 🔑 Understanding the Login Flow

The sandbox demonstrates the complete authentication flow for Mini Apps using Startale SDK:

### 1. **Wallet Connection**
- Users connect via **Startale App** using RainbowKit UI
- The Startale connector is configured in `src/lib/wagmi.ts`
- Connection uses the `@startale/app-sdk` package

### 2. **Smart Contract Wallet**
- **Important:** Startale App SDK returns a **smart contract wallet address**, not an EOA (Externally Owned Account)
- This address is the user's on-chain identity for all transactions
- Access the address via wagmi hooks: `const { address } = useAccount()`

### 3. **Session Management**
- Once connected, the wallet address is available throughout the app
- Protected routes (like `/miniapps`) are only accessible when authenticated
- Users can disconnect via the header button

---

## 📡 Notifications

For the full notification architecture (how tokens flow, who pays for what, notify vs Neynar), see:

### **[NOTIFICATIONS.md](./NOTIFICATIONS.md)**

---

## 📚 Building Your Own Mini App

For detailed instructions on creating a Farcaster Mini App integrated with Startale SDK, see:

### **[INTEGRATION.md](./INTEGRATION.md)**

This guide covers:
- Creating and signing a Farcaster Mini App manifest
- Account association and domain verification
- Configuring wagmi with Startale connector
- Using Startale SDK directly (with or without wagmi)
- Complete code examples and reference implementations

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
  <p>Built with ❤️ for the Startale ecosystem</p>
</div>
