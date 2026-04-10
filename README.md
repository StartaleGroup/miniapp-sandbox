<div align="center">
  <img src="public/favicon.svg" alt="MiniApps Sandbox Logo" width="120" height="120">
  <h1>MiniApps Sandbox</h1>
  <p>Development sandbox for Farcaster Mini Apps with Startale App</p>
</div>

---

## 📋 Overview

Build and test Farcaster Mini Apps that integrate with **Startale App** for wallet authentication and Soneium blockchain interactions.

**Key Features:**
- 🔐 Startale Wallet Authentication
- ⛓️ Soneium Network Support
- 🔗 Wagmi Integration
- 📱 Mini Apps Gallery
- 🔔 Firebase-hosted Notification Server

---

## 🚀 Quick Start

### Start All Services

```bash
pnpm dev
```

This starts:
- **Sandbox** at `http://localhost:3100` — host/client UI


---

## 📱 Add Your Mini App

Edit [src/pages/configMiniApps.ts](src/pages/configMiniApps.ts) and add your Mini App to the gallery.

---

## 🔑 Login Flow

The sandbox demonstrates authentication using Startale SDK:

1. **Connect** - Users connect via Startale App (RainbowKit UI)
2. **Smart Contract Wallet** - Startale returns a smart contract wallet address (not EOA)
3. **Session** - Access the address via `const { address } = useAccount()`

---

## 📚 Documentation

### Build Your Own Mini App

**[INTEGRATION.md](./INTEGRATION.md)** — Step-by-step guide:
- Creating and signing a Farcaster Mini App
- Integrating Startale SDK
- Wagmi configuration
- Code examples

### Notifications

**[NOTIFICATIONS.md](./NOTIFICATIONS.md)** — How to use notifications:
- Enable notifications in your Mini App
- Send notifications from client or backend
- Rate limits and best practices

### Notification Server

The production notification relay runs on **Firebase Cloud Functions** (hosted by StartaleApp). Configure it via `.env.local`:

```env
VITE_NOTIFICATIONS_URL=<firebase-functions-url>
VITE_NOTIFICATIONS_API_KEY=<your-api-key>
```

See `.env.local.example` for the required variables.

---

## 📄 License

MIT

---

<div align="center">
  <p>Built with ❤️ for the Startale ecosystem</p>
</div>
