# notify

Host-side notification delivery service for the MiniApp Sandbox.

## What is this?

`notify` is the **host-side** notification infrastructure that:
- Receives notification tokens from miniapps (via SDK lifecycle events)
- Validates incoming notification requests
- Stores active tokens in SQLite
- Broadcasts notifications to connected clients via Server-Sent Events (SSE)

In production Farcaster, this functionality is built into the Farcaster host infrastructure. In the sandbox, `notify` simulates that infrastructure for local development.

> **Important:** `notify` is NOT equivalent to Neynar. They sit on opposite sides of the notification flow:
> - **notify** = host-side (like Farcaster's built-in infra)
> - **Neynar** = miniapp-developer-side convenience service
>
> See [NOTIFICATIONS.md](../NOTIFICATIONS.md) for the complete architecture.

---

## Quick Start

### Development

```bash
pnpm install
pnpm dev
```

The service will start on `http://localhost:3200`

### Docker

From the sandbox root:
```bash
docker compose up notify
```

---

## API Endpoints

### `POST /webhook`
Receives lifecycle events from the host (sandbox). Miniapps never call this directly.

**Events:**
- `miniapp_added` - User added the miniapp, includes `notificationDetails` with token
- `notifications_enabled` - User re-enabled notifications
- `notifications_disabled` - User disabled notifications
- `miniapp_removed` - User removed the miniapp

**Request body:**
```json
{
  "event": "miniapp_added",
  "notificationDetails": {
    "url": "http://localhost:3200/api/miniapps-notifications",
    "token": "uuid-token-here"
  }
}
```

Also supports JFS (signed) format with FID in header.

### `POST /api/miniapps-notifications`
Receives notification requests from miniapps. Validates tokens and broadcasts to SSE clients.

**Request body:**
```json
{
  "notificationId": "unique-id",
  "title": "Title (max 32 chars)",
  "body": "Body text (max 128 chars)",
  "targetUrl": "https://miniapp.example.com",
  "tokens": ["token1", "token2"]  // max 100 tokens per request
}
```

**Response:**
```json
{
  "result": {
    "successfulTokens": ["token1"],
    "invalidTokens": [],
    "rateLimitedTokens": []
  }
}
```

### `POST /send`
Convenience endpoint for sending notifications to all active tokens (or specific FIDs).

**Request body:**
```json
{
  "title": "Title",
  "body": "Body text",
  "targetUrl": "https://miniapp.example.com",
  "notificationId": "optional-id",
  "fids": [3, 5]  // optional - if omitted, sends to all active tokens
}
```

### `GET /events`
Server-Sent Events stream for real-time notification delivery to sandbox UI.

### `GET /tokens`
Debug endpoint listing all stored tokens.

**Query params:**
- `?status=active` - filter by status
- `?fid=3` - filter by FID

### `GET /health`
Health check with stats.

**Response:**
```json
{
  "status": "ok",
  "uptime": 123,
  "activeTokens": 5,
  "sseClients": 2,
  "version": "0.1.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_PORT` | `3200` | Port to listen on |
| `NOTIFY_DB_PATH` | `./data/notify.db` | SQLite database path |

---

## Database

Uses SQLite with WAL mode for the `notification_tokens` table:

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary key |
| `fid` | INTEGER | Farcaster ID (0 if unavailable) |
| `token` | TEXT | Unique notification token (UUID) |
| `notification_url` | TEXT | URL to send notifications to (always this service) |
| `status` | TEXT | `active`, `disabled`, or `removed` |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

The database is stored in `data/notify.db` and is git-ignored.

---

## Architecture Notes

### Token Flow

```
1. User clicks "Enable Notifications" in miniapp
        ↓
2. Sandbox host generates token and URL
        ↓
3. Host registers token with notify (POST /webhook)
        ↓
4. Host sends token to miniapp via SDK
        ↓
5. Miniapp stores token for later use
        ⋮
   (later, when miniapp wants to send notification)
        ↓
6. Miniapp POSTs to the URL with the token
        ↓
7. notify validates token and broadcasts via SSE
        ↓
8. Sandbox UI displays notification
```

### Who calls what

| Endpoint | Called by | Purpose |
|---|---|---|
| `/webhook` | Sandbox host | Register/update tokens |
| `/api/miniapps-notifications` | Miniapps | Send notifications |
| `/send` | Developers (testing) | Convenience for sending to all tokens |
| `/events` | Sandbox UI | Receive notification stream |
| `/tokens` | Developers (debugging) | View stored tokens |

---

## Development

### Project Structure

```
notify/
├── src/
│   ├── index.ts          # Server entry point
│   ├── config.ts         # Environment config
│   ├── types.ts          # TypeScript types
│   ├── db.ts             # SQLite initialization
│   ├── sse.ts            # SSE broadcast manager
│   └── routes/
│       ├── webhook.ts    # POST /webhook
│       ├── ingest.ts     # POST /api/miniapps-notifications
│       ├── send.ts       # POST /send
│       ├── events.ts     # GET /events
│       ├── tokens.ts     # GET /tokens
│       └── health.ts     # GET /health
├── data/                 # SQLite database (git-ignored)
├── package.json
├── tsconfig.json
└── README.md
```

### Tech Stack

- **Hono** - Fast web framework
- **better-sqlite3** - Synchronous SQLite driver
- **Zod** - Schema validation
- **tsx** - TypeScript execution

### Scripts

```bash
pnpm dev        # Development with watch mode
pnpm start      # Production (no watch)
pnpm typecheck  # Type checking only
```

---

## Miniapp Integration

Miniapps **never interact with notify directly**. They only:
1. Receive `notificationDetails` from the host via SDK
2. Store the token and URL
3. POST to that URL when they want to send notifications

The miniapp doesn't know or care that the URL points to `notify` in the sandbox, or to Farcaster's infrastructure in production.

**Example (from miniapp code):**

```typescript
// 1. Get notification details from host
const { result } = await sdk.actions.addMiniApp()
const { token, url } = result.notificationDetails

// 2. Later, send a notification
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notificationId: crypto.randomUUID(),
    title: 'Hello!',
    body: 'Something happened',
    targetUrl: window.location.href,
    tokens: [token],
  }),
})
```

---

## License

MIT
