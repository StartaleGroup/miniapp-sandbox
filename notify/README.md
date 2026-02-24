# notify

Host-side notification service for the MiniApp Sandbox.

## What is this?

`notify` is the host-side notification infrastructure that stores tokens, validates requests, and delivers notifications to users.

In production Farcaster, this is built into the Farcaster infrastructure. In the sandbox, `notify` simulates it for local development.

## Quick Start

```bash
pnpm install
pnpm dev
```

Service runs on `http://localhost:3200`

## Key Endpoints

### `POST /api/miniapps-notifications`
Send notifications from your Mini App.

**Request:**
```json
{
  "notificationId": "unique-id",
  "title": "Title (max 32 chars)",
  "body": "Body text (max 128 chars)",
  "targetUrl": "https://miniapp.example.com",
  "tokens": ["token1", "token2"]
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

### `POST /webhook`
Internal - receives lifecycle events from the sandbox host.

### `GET /events`
Server-Sent Events stream for real-time notification delivery to sandbox UI.

### `GET /health`
Health check with stats.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_PORT` | `3200` | Port |
| `NOTIFY_DB_PATH` | `./data/notify.db` | SQLite database path |

## How Mini Apps Use This

Mini Apps don't interact with `notify` directly. They:

1. Receive `notificationDetails.url` from the host via SDK
2. Store the token
3. POST to that URL when they want to send notifications

```typescript
// Get from host
const { result } = await sdk.actions.addMiniApp();
const { token, url } = result.notificationDetails;

// Send notification later
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
});
```

## Tech Stack

- **Hono** - Web framework
- **better-sqlite3** - SQLite driver
- **Zod** - Validation

## License

MIT
