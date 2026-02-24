# Farcaster Chat — Implementation Reference

## Current State of Farcaster Chat

### SDK Actions (as of @farcaster/miniapp-sdk)

The Farcaster Mini App SDK **does not include any chat or direct messaging actions**. The complete list of supported actions is:

- `ready()` — Hides the splash screen
- `openUrl(url)` — Opens an external URL
- `close()` — Closes the mini app
- `setPrimaryButton(options)` — Configures the primary button
- `addFrame()` / `addMiniApp()` — Prompts user to add/favorite the app
- `signIn(options)` — Sign In with Farcaster
- `viewCast(options)` — Opens a specific cast in the client
- `viewProfile(options)` — Opens a Farcaster profile
- `composeCast(options)` — Opens the cast composer
- `viewToken(options)` — View a token
- `sendToken(options)` — Prompt user to send tokens
- `swapToken(options)` — Prompt user to swap tokens
- `openMiniApp(options)` — Opens another mini app
- `requestCameraAndMicrophoneAccess()` — Request device permissions

There is no `openChat`, `sendDirectCast`, or any messaging primitive.

### Direct Casts (Farcaster DMs)

Direct Casts are **Warpcast-proprietary**, not part of the open Farcaster protocol:

- Use X25519-based Double-Ratchet encryption (E2E)
- FIP #99 (protocol-level DMs) is at Stage 1 (Ideas) since June 2023 — not implemented
- Only the Warpcast API can send DCs: `PUT https://api.warpcast.com/v2/ext-send-direct-cast`
- No public API exists to **read** Direct Casts
- Requires a Warpcast API key (obtained from Farcaster dev settings)

### What the SDK Can Do for Conversations

| Capability | Method | Scope |
|---|---|---|
| Cast to a channel | `composeCast({ channelKey })` | Public |
| Reply to a cast (thread) | `composeCast({ parent: { type: 'cast', hash } })` | Public |
| View a cast conversation | `viewCast({ hash })` | Public |
| Know launch channel | `context.location` (type: `channel`) | Read-only |
| Fetch conversation threads | Neynar `GET /v2/farcaster/cast/conversation/` | Server-side |

---

## Implementation Approaches

### Approach A: Stub Host Action (Lightweight)

Add a simulated `openChat` action so mini apps can call it without errors.

**Changes to `src/components/FarcasterMiniappHost.tsx`:**

1. Add `'actions.openChat'` to `getCapabilities()` (line ~113)
2. Add host action in `createHostActions()` (line ~372):
   ```typescript
   openChat: ({ fid, text }: { fid?: number; text?: string }) => {
     console.log('[HOST] openChat called', { fid, text })
     // Show a simulated chat panel or toast
   }
   ```

**Infrastructure:** None.

**Value:** Lets mini apps test the API shape. Prevents runtime errors when an app tries to invoke chat.

---

### Approach B: Warpcast Direct Cast Proxy (Medium)

Send real Direct Casts from the sandbox via the Warpcast API.

**Changes to `src/components/FarcasterMiniappHost.tsx`:**

1. Same as Approach A for the action handler
2. `openChat` posts to a new route on the notify service:
   ```typescript
   openChat: async ({ fid, text }: { fid?: number; text?: string }) => {
     await waitForApproval('Send Direct Cast', `To FID ${fid}: ${text}`)
     await fetch('http://localhost:3200/api/direct-cast', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ recipientFid: fid, message: text }),
     })
   }
   ```

**New infrastructure:**

| Component | Location | Purpose |
|---|---|---|
| `POST /api/direct-cast` route | `notify/src/routes/direct-cast.ts` | Proxies to Warpcast API with Bearer token |
| `WARPCAST_API_KEY` env var | `notify/.env` | Authentication for Warpcast API |

**Warpcast API call format:**
```
PUT https://api.warpcast.com/v2/ext-send-direct-cast
Authorization: Bearer <WARPCAST_API_KEY>
Content-Type: application/json

{
  "recipientFid": 12345,
  "message": "Hello from the sandbox!",
  "idempotencyKey": "<uuid>"
}
```

**Limitations:**
- Send-only — cannot read DC responses
- Requires a real Warpcast API key
- Fire-and-forget messaging

---

### Approach C: Built-in Chat System (Heavy)

Build a full real-time messaging system within the sandbox, independent of Farcaster's DC infrastructure.

**Changes to `src/components/FarcasterMiniappHost.tsx`:**

1. New capabilities: `actions.openChat`, `actions.sendMessage`, `actions.getConversations`
2. New host actions (line ~372):
   ```typescript
   openChat: async ({ fid }: { fid: number }) => {
     // Open chat panel, create/resume conversation
   },
   sendMessage: async ({ conversationId, text }: { conversationId: string; text: string }) => {
     // POST to chat service
   },
   getConversations: async () => {
     // GET from chat service
   },
   ```
3. Expose active conversations in `createHostContext()` (line ~59)
4. Maintain a WebSocket connection for real-time message delivery

**New infrastructure:**

| Component | Location | Purpose |
|---|---|---|
| **Chat service** | `chat/` (new directory, port ~3300) | WebSocket + REST server (Hono) |
| **SQLite tables** | `chat/data/chat.db` | `conversations`, `messages`, `participants` |
| **WebSocket layer** | Chat service | Real-time message delivery |
| **ChatProvider** | `src/providers/ChatProvider.tsx` | React context for WS connection + message state |
| **Chat UI** | `src/components/ChatPanel.tsx` | Conversation list, message thread, composer |
| Updated `start.sh` / `stop.sh` | Root | Start/stop chat service alongside notify |

**Database schema:**
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  fid INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, fid)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_fid INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Chat service routes:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/conversations` | POST | Create or resume a conversation |
| `/conversations` | GET | List conversations for a FID |
| `/conversations/:id/messages` | GET | Fetch message history |
| `/conversations/:id/messages` | POST | Send a message |
| `/ws` | WS | Real-time message events |
| `/health` | GET | Health check |

**Data flow:**
```
Mini App (iframe)                 Sandbox Host                    Chat Service (:3300)
    |                                |                                |
    | sdk.actions.openChat({fid:3})  |                                |
    |------------------------------->|                                |
    |                                |  POST /conversations           |
    |                                |------------------------------->|
    |                                |  WS: subscribe to conv         |
    |                                |<------------------------------>|
    |                                |                                |
    |  (host shows chat panel)       |                                |
    |                                |  POST /messages                |
    |                                |------------------------------->|
    |                                |  WS: new_message event         |
    |                                |<-------------------------------|
    |  postFrameEvent(chatMessage)   |                                |
    |<-------------------------------|                                |
```

---

### Approach D: Public Thread-Based Chat (Protocol-Native)

Use `composeCast` with thread replies as a conversation mechanism.

**Changes to `src/components/FarcasterMiniappHost.tsx`:**

1. Replace `composeCast` stub (line ~383) with a working cast composer UI
2. Replace `viewCast` stub with a thread viewer that fetches replies

**New infrastructure:**

| Component | Location | Purpose |
|---|---|---|
| Neynar API integration | `notify/src/routes/casts.ts` or new service | Fetch cast threads via `GET /v2/farcaster/cast/conversation/` |
| `NEYNAR_API_KEY` env var | `.env` | Auth for Neynar API |
| Cast composer UI | `src/components/CastComposer.tsx` | Compose casts and replies |
| Thread viewer UI | `src/components/CastThread.tsx` | Display cast conversation threads |

**Limitations:** All messages are **public** casts — not private messaging.

---

## Comparison

| Approach | Effort | Realism | Private Messaging | Read Messages | Infrastructure |
|---|---|---|---|---|---|
| **A. Stub action** | Low | Low | No | No | None |
| **B. Warpcast DC proxy** | Medium | High | Yes (send-only) | No | 1 new route + API key |
| **C. Built-in chat** | High | Medium | Yes | Yes | New service + DB + WS |
| **D. Public threads** | Medium | High | No | Yes | Neynar API + UI |

## Recommended Path

**A + B** for a sandbox/dev tool: stub the `openChat` action with a UI, and optionally proxy real DC sends through the Warpcast API. This mirrors how the sandbox handles notifications — local simulation with enough realism to develop against.

If full bidirectional chat is needed for testing, **C** provides complete control but requires significant new infrastructure (a dedicated chat service with WebSocket support, database, and UI components).
