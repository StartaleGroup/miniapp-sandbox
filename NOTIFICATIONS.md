## Notification Architecture

### Roles

| Component | Role | Example |
|---|---|---|
| **Host/Client** | Farcaster app that runs miniapps, delivers notifications to users | Farcaster, this Sandbox |
| **Host Notification Service** | Host's own backend that stores tokens and delivers notifications | Farcaster's built-in infra (production), meymar (sandbox) |
| **Miniapp Notification Helper** | Optional third-party service that helps miniapp developers manage tokens and send notifications | Neynar |
| **Miniapp** | Third-party app running inside the host | Inking, Mustard |
| **Miniapp Backend** | Optional server for the miniapp | mustard-backend |

### Notification Flow

```
1. User clicks "Enable Notifications" in miniapp
        |
        v
2. HOST generates { token, url } where url = HOST's notification service
        |
        +--> Sends to miniapp via SDK (addMiniApp response)
        +--> Sends webhook to miniapp's webhookUrl (from manifest)
        +--> Registers token with HOST's notification service
        |
3. Miniapp stores { token, url } for later use
        .
        . (later, when miniapp wants to notify user)
        .
4. Miniapp POSTs to the url it received from HOST (not its own webhookUrl!)
        |
        v
5. HOST's notification service validates token and delivers to user
```

**Key insight**: The `notificationDetails.url` always points to the **HOST's** service. The miniapp's `webhookUrl` is for **receiving** lifecycle events, not for sending notifications.

### meymar vs Neynar — NOT the same thing

meymar and Neynar sit on **opposite sides** of the notification flow. They are not interchangeable.

```
                HOST SIDE                          MINIAPP SIDE
          (sandbox operator)                  (miniapp developer)
         ┌─────────────────┐                ┌─────────────────┐
         │     meymar      │  ◄── POSTs ──  │  Neynar (opt.)  │
         │                 │                │                 │
         │ - Stores tokens │                │ - Stores tokens │
         │ - Validates     │                │ - Manages       │
         │   incoming      │                │   webhooks      │
         │   notifications │                │ - Calls host's  │
         │ - Delivers to   │                │   notification  │
         │   user via SSE  │                │   URL on behalf │
         │                 │                │   of miniapp    │
         │ Equivalent to:  │                │                 │
         │ Farcaster's     │                │ Paid service    │
         │ built-in infra  │                │ for miniapp     │
         └─────────────────┘                │ developers      │
                                            └─────────────────┘
```

| | **meymar** | **Neynar** |
|---|---|---|
| **Side** | Host side | Miniapp developer side |
| **Who runs it** | You (sandbox/host operator) | Neynar (third-party SaaS) |
| **Who pays** | You (infra costs) | Miniapp developer |
| **Purpose** | Receive notifications, validate tokens, deliver to users | Help miniapp devs manage tokens and send notifications |
| **Equivalent to** | Farcaster's built-in notification infra | A convenience API for miniapp developers |
| **Knows about miniapps?** | No — just validates tokens and delivers | Yes — manages per-miniapp webhooks and tokens |
| **The host sees it?** | Yes — it IS the host's service | No — black box behind miniapp's webhookUrl |

The host never interacts with Neynar. The miniapp developer never interacts with meymar directly (only through the `notificationDetails.url` they received from the host).

### Who Provides What

| URL | Set By | Points To | Purpose |
|---|---|---|---|
| `webhookUrl` (in manifest) | Miniapp developer | Miniapp's backend | Host sends lifecycle events TO miniapp |
| `notificationDetails.url` | Host/client | Host's notification service | Miniapp sends notifications TO host |
| `notificationDetails.token` | Host/client | - | Auth token for sending notifications |

### Three Notification Scenarios

#### Scenario 1: No Notifications

Miniapp does not use notifications at all.

| | Self-hosted | With Neynar |
|---|---|---|
| `webhookUrl` in manifest | Not set | Not set |
| Miniapp backend needed | No | No |
| Host notification service needed | No | No |
| Cost | Free | Free |

#### Scenario 2: Client-Only Notifications (while miniapp is open)

Miniapp sends notifications directly from the browser while the user has it open. No backend needed, but notifications **stop when the app is closed**.

| | Self-hosted | With Neynar |
|---|---|---|
| `webhookUrl` in manifest | Not needed | `https://api.neynar.com/f/app/<id>/event` |
| Miniapp backend needed | No | No |
| Who sends notification | Miniapp JS (browser) POSTs to `notificationDetails.url` | Same |
| Token storage | localStorage in browser | Neynar stores tokens (miniapp also gets them via SDK) |
| Works when app closed | **No** | **No** |
| Who pays | Free (host handles delivery) | Miniapp developer pays Neynar for webhook management |

**Example**: Inking - sends "NFT minted!" notification immediately from browser code.

```
Miniapp (browser JS)
    | fetch(notificationDetails.url, { tokens: [token], title, body })
    v
Host's notification service (meymar in sandbox, Farcaster's infra in production)
    |
    v
User sees notification
```

#### Scenario 3: Backend Notifications (even when miniapp is closed)

Miniapp has its own backend server that schedules and sends notifications independently of whether the user has the miniapp open.

| | Self-hosted | With Neynar |
|---|---|---|
| `webhookUrl` in manifest | `https://my-backend.com/webhook` | `https://api.neynar.com/f/app/<id>/event` |
| Miniapp backend needed | Yes | Yes (but simpler - Neynar manages tokens) |
| Who sends notification | Backend POSTs to `notificationDetails.url` | Backend calls Neynar API, Neynar forwards to host |
| Token storage | Miniapp backend database | Neynar manages tokens for you |
| Works when app closed | **Yes** | **Yes** |
| Who pays | Free (self-hosted infra costs only) | Miniapp developer pays Neynar |

**Example**: Mustard - after minting, backend schedules a "mint again!" notification for 60 seconds later. Works even if user closes the miniapp.

**Self-hosted flow**:
```
Miniapp (browser) --> Miniapp Backend: "user minted, schedule notification"
                          |
                          | (60s later, via scheduler)
                          |
                          | fetch(notificationDetails.url, { tokens, title, body })
                          v
                     Host's notification service (meymar in sandbox, Farcaster's infra in production)
                          |
                          v
                     User sees notification
```

**With Neynar**:
```
Miniapp (browser) --> Miniapp Backend: "user minted, schedule notification"
                          |
                          | (60s later)
                          |
                          | POST https://api.neynar.com/v2/farcaster/frame/notifications/
                          v
                     Neynar (looks up stored tokens, forwards to host)
                          |
                          v
                     Host (Farcaster) delivers to user
```

### Who Pays for What

| Service | Who pays | What you get |
|---|---|---|
| **Farcaster notification delivery** | Free (Farcaster absorbs cost) | Host delivers notifications to users |
| **Neynar (miniapp-side)** | Miniapp developer | Managed webhook handling, token storage, send API, analytics |
| **Self-hosted backend** | Miniapp developer (infra costs) | Full control, no per-API-call fees |
| **meymar (sandbox)** | Nobody (local dev) | Simulates Farcaster's host notification infrastructure locally |

**Neynar pricing**: Credit-based tiers - Free (200K credits), Starter, Growth, Scale, Enterprise. Also supports x402 pay-per-use via onchain USDC micropayments.

### Rate Limits (enforced by host)

- 1 notification per 30 seconds per token
- 100 notifications per day per token

### Sandbox Projects

| Project | Port | Role | Notifications |
|---|---|---|---|
| **miniapp-sandbox** | 3100 | Host/Client | Displays notifications via SSE from meymar |
| **meymar** | 3200 | Host Notification Service (like Farcaster's built-in infra) | Stores tokens, broadcasts notifications |
| **inking** | 5173 | Miniapp (client-only) | Scenario 2: browser-only notifications |
| **mustard** | 5174 | Miniapp (with backend) | Scenario 3: backend-scheduled notifications |
| **mustard-backend** | 3300 | Miniapp Backend | Schedules delayed notifications, sends to meymar |

---

