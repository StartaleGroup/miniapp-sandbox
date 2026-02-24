# Notifications

The sandbox includes a built-in notification service (`notify`) that mimics how notifications work in production Farcaster.

## How it works

```
1. User enables notifications in your Mini App
        ↓
2. Host generates a token + URL and sends it to your app
        ↓
3. Your app stores the token for later use
        ⋮
   (when you want to notify the user)
        ↓
4. Your app POSTs to the URL with the token
        ↓
5. Host validates and delivers the notification
```

## Usage

### Enable notifications in your Mini App

```typescript
import sdk from '@farcaster/miniapp-sdk';

// Request notification permission
const { result } = await sdk.actions.addMiniApp();
const { token, url } = result.notificationDetails;

// Store these for later
localStorage.setItem('notificationToken', token);
localStorage.setItem('notificationUrl', url);
```

### Send a notification

```typescript
const token = localStorage.getItem('notificationToken');
const url = localStorage.getItem('notificationUrl');

await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notificationId: crypto.randomUUID(),
    title: 'Hello!',  // max 32 chars
    body: 'Something happened',  // max 128 chars
    targetUrl: window.location.href,
    tokens: [token],
  }),
});
```

## Rate Limits

- 1 notification per 30 seconds per token
- 100 notifications per day per token

## Architecture

The `notify` service sits on the host side (sandbox). Your Mini App simply POSTs to the URL it received from the host.

```
┌─────────────┐         ┌─────────────┐         ┌──────────┐
│  Your Mini  │  POST   │    notify   │   SSE   │ Sandbox  │
│     App     │ ──────→ │  (host-side │ ──────→ │    UI    │
│             │         │   service)  │         │          │
└─────────────┘         └─────────────┘         └──────────┘
                             ↑
                             │ validates token
                             │ enforces rate limits
                             │ broadcasts to users
```

In production Farcaster, this infrastructure is built-in. In the sandbox, `notify` simulates it locally.

## With a Backend

If your Mini App has a backend server, it can send notifications even when the user closes your app:

```typescript
// In your backend
app.post('/schedule-notification', async (req, res) => {
  const { token, url } = req.body;

  // Send immediately or schedule for later
  setTimeout(async () => {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: crypto.randomUUID(),
        title: 'Come back!',
        body: 'We miss you',
        targetUrl: 'https://your-miniapp.com',
        tokens: [token],
      }),
    });
  }, 60000);  // 60 seconds later

  res.json({ ok: true });
});
```

## Using Neynar

[Neynar](https://neynar.com) is a third-party service that simplifies notification management for Mini App developers. It sits on the **Mini App side** (not the host side).

**What Neynar does:**
- Stores notification tokens for you
- Manages webhook lifecycle events
- Provides a simple API to send notifications
- Handles token management automatically

**When to use Neynar:**
- You want managed infrastructure instead of self-hosting
- You need webhook handling without building your own backend
- You prefer a simple API over managing tokens yourself

**How it works:**

```typescript
// 1. Set webhookUrl in your manifest to Neynar
{
  "webhookUrl": "https://api.neynar.com/f/app/<your-id>/event"
}

// 2. Send notifications via Neynar API
fetch('https://api.neynar.com/v2/farcaster/frame/notifications', {
  method: 'POST',
  headers: {
    'api_key': 'YOUR_NEYNAR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Hello!',
    body: 'Something happened',
    targetUrl: 'https://your-miniapp.com',
    // Neynar handles token lookup for you
  })
});
```

Neynar is **optional** — you can self-host everything or use Neynar as a convenience layer. The choice depends on your infrastructure preferences and budget.

