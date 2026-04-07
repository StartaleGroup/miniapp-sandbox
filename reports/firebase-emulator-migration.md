# Migration: Replace notify server with Firebase emulator

Replace the internal `notify/` Hono server with the Firebase Cloud Functions emulator (or deployed Cloud Run) for notification handling.

## Quality gates

Each step must pass before moving to the next:

| Repo | Command | What it checks |
|------|---------|----------------|
| `miniapp-notifications-firebase/functions` | `pnpm build` | TypeScript compiles (`tsc`) |
| `miniapp-notifications-firebase/functions` | `pnpm lint` | Biome linter (recommended rules, tabs, 100 line width) |
| `miniapp-notifications-firebase/functions` | `firebase emulators:exec --only firestore "pnpm test" --project startale-notifs-test` | Vitest against Firestore emulator |
| `miniapp-sandbox` | `pnpm build` | Vite build + `tsc --noEmit` |

## Environment switching

The sandbox uses env vars to switch between targets:

| Target | `VITE_NOTIFICATIONS_URL` | `VITE_NOTIFICATIONS_API_KEY` |
|--------|--------------------------|------------------------------|
| Emulator | `http://127.0.0.1:5001/miniapp-notifications/us-central1/notifications` | `test-sandbox-key` |
| Dev (Cloud Run) | `https://notifications-a6nlxdy62q-uc.a.run.app` | `<real key>` |

Set in `.env.local` (gitignored) or inline: `VITE_NOTIFICATIONS_URL=... pnpm dev`

Defaults to emulator URL if unset.

## Endpoint paths (relative to base URL)

| Endpoint | Path |
|----------|------|
| Webhook | `/webhook` |
| Ingest | `/v1/notifications` |
| Sent (new) | `/v1/notifications/sent` |

---

## Step 1: Firebase — store & serve sent notifications

**Goal**: Add `sent_notifications` Firestore collection write in ingest route + GET endpoint for polling. Add tests. All existing tests must continue to pass.

### Code changes (miniapp-notifications-firebase)

**`functions/src/routes/ingest.ts`** — After the token loop, write to `sent_notifications`:
```ts
// Cache userAddress during token loop (add alongside successfulTokens.push):
const successfulUserAddresses: string[] = []
// inside loop, after markSent:
successfulUserAddresses.push(tokenRecord.userAddress)

// After loop:
if (successfulTokens.length > 0) {
  const db = getDb()
  await db.collection("sent_notifications").doc(notificationId).set({
    notificationId, title: parsed.data.title, body: parsed.data.body,
    targetUrl: parsed.data.targetUrl,
    userAddresses: successfulUserAddresses,
    createdAt: Timestamp.now(),
  })
}
```

**`functions/src/routes/sent.ts`** (new) — GET endpoint:
- Query `sent_notifications` ordered by `createdAt` desc, limit 50
- Support `?since=<ISO>` to filter new-only
- Return `{ notifications: [...] }`
- No auth required

**`functions/src/index.ts`** — Register: `app.route("/v1/notifications/sent", sentRoute)`

**`functions/test/setup.ts`** — Register sent route in `createTestApp()`:
```ts
import { sentRoute } from "../src/routes/sent.js";
// inside createTestApp():
app.route("/v1/notifications/sent", sentRoute);
```

**`firebase.json`** — Add `"functions": { "port": 5001 }` to `emulators` block.

### Tests

**`functions/test/sent.test.ts`** (new) — Following the existing test patterns in `functions/test/`:
- Uses `createTestApp`, `postJson`, `TEST_API_KEY` from `./setup.js`
- Uses `seedToken()` helper (same pattern as `ingest.test.ts`)
- Uses `getFirestore()` to verify Firestore state

Test cases:

1. **`GET /v1/notifications/sent` returns empty array when no notifications exist**
   ```ts
   const res = await app.request("/v1/notifications/sent")
   expect(res.status).toBe(200)
   const body = await res.json()
   expect(body.notifications).toEqual([])
   ```

2. **`GET /v1/notifications/sent` returns notification after successful ingest**
   - Seed token via `seedToken("tok-1")`
   - POST `/v1/notifications` with `tokens: ["tok-1"]`
   - GET `/v1/notifications/sent`
   - Verify response has notification with correct `notificationId`, `title`, `body`, `targetUrl`

3. **`GET /v1/notifications/sent?since=<ISO>` filters by time**
   - Seed token, send notification A
   - Record timestamp
   - Send notification B
   - GET `/v1/notifications/sent?since=<timestamp>` → only B returned

4. **Ingest with no successful tokens does NOT write to sent_notifications**
   - POST `/v1/notifications` with unknown token
   - GET `/v1/notifications/sent` → empty

5. **Ingest writes correct userAddresses from token records**
   - Seed two tokens for different users
   - POST `/v1/notifications` with both tokens
   - GET `/v1/notifications/sent` → `userAddresses` contains both addresses

### Existing tests must still pass

The `sent_notifications` write in `ingest.ts` should not break any existing `ingest.test.ts` tests — it's additive. But the `beforeEach` in `setup.ts` already clears all Firestore data between tests, so the new collection is cleaned automatically.

### Verification

```bash
cd miniapp-notifications-firebase/functions

# All must pass:
pnpm build
pnpm lint
firebase emulators:exec --only firestore "pnpm test" --project startale-notifs-test
```

---

## Step 2: Sandbox — point to Firebase emulator + cleanup notify

**Goal**: Replace hardcoded localhost:3200 URLs with configurable Firebase URLs. Replace SSE with polling. Remove `notify/` folder. Fix build.

### Code changes (miniapp-sandbox)

**`src/lib/notifications-config.ts`** (new) — Single config source:
```ts
const EMULATOR_URL = 'http://127.0.0.1:5001/miniapp-notifications/us-central1/notifications'

export const NOTIFICATIONS_BASE_URL = import.meta.env.VITE_NOTIFICATIONS_URL || EMULATOR_URL
export const NOTIFICATIONS_API_KEY = import.meta.env.VITE_NOTIFICATIONS_API_KEY || 'test-sandbox-key'

export const NOTIFICATION_INGEST_URL = `${NOTIFICATIONS_BASE_URL}/v1/notifications`
export const WEBHOOK_URL = `${NOTIFICATIONS_BASE_URL}/webhook`
export const SENT_NOTIFICATIONS_URL = `${NOTIFICATIONS_BASE_URL}/v1/notifications/sent`
```

**`src/components/FarcasterMiniappHost.tsx`**:
- Import `NOTIFICATION_INGEST_URL`, `WEBHOOK_URL`, `NOTIFICATIONS_API_KEY` from `~/lib/notifications-config`
- Remove old `NOTIFICATION_SERVER_URL` and `NOTIFY_WEBHOOK_URL` constants
- Add `'x-api-key': NOTIFICATIONS_API_KEY` header to webhook fetch
- Add `userAddress: address ?? '0x0000000000000000000000000000000000000000'` to webhook payload
- `NOTIFICATION_INGEST_URL` is returned as `details.url` so miniapps know where to POST

**`src/providers/NotificationProvider.tsx`**:
- Import `SENT_NOTIFICATIONS_URL` from `~/lib/notifications-config`
- Remove `EventSource` / SSE / `NOTIFY_EVENTS_URL` constant
- Add `setInterval` polling (3s) against `GET ${SENT_NOTIFICATIONS_URL}?since=<lastPollTime>`
- Track seen `notificationId`s in a `Set` to prevent duplicates
- Keep `enrichNotificationWithIcon` as-is

**Delete `notify/` directory** entirely.

**`start.sh`** — Remove notify install/startup/PID lines; keep only sandbox `pnpm dev`:
```bash
#!/bin/bash
echo "Starting MiniApp Sandbox on port 3100..."
pnpm install
pnpm dev
```

**`stop.sh`** — Simplify (or delete — `pnpm dev` is foreground now).

### Verification

```bash
cd miniapp-sandbox

# Must pass:
pnpm build    # vite build + tsc --noEmit

# notify/ is gone:
ls notify/    # should fail

# Manual e2e (requires Firebase emulator running from Step 1):
pnpm dev
# 1. Open http://localhost:3100, connect wallet
# 2. Open a miniapp, trigger sdk.actions.addMiniApp()
# 3. Check emulator logs — webhook received
# 4. Check http://127.0.0.1:4000/firestore — tokens collection has new entry
# 5. Send notification from miniapp — bell shows it within ~3s

# Switch to Cloud Run:
VITE_NOTIFICATIONS_URL=https://notifications-a6nlxdy62q-uc.a.run.app VITE_NOTIFICATIONS_API_KEY=<key> pnpm dev
# Same flow works against deployed backend
```
