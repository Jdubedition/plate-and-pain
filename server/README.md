# Plate & Pain — multiplayer server

Cloudflare Workers + **`MatchLevel`** Durable Object. Phase 1: local WebSocket scaffold, GG-style envelopes, **`MatchPresence`** broadcasts for propagation testing.

## Run locally

```bash
cd server
npm install
npm run dev
```

Uses **`8787`** (see `package.json` `dev` script). UE / tools connect to **`ws://127.0.0.1:8787/connect`**.

Health check: **`http://127.0.0.1:8787/health`** → `OK`.

## Generated types

After changing `wrangler.jsonc` bindings:

```bash
npm run cf-typegen
```

## Wire protocol (Phase 1)

### Envelope

All JSON framed messages:

- `messageType` (string)
- `playerGuid` (UE-style 32 hex chars, uppercase, no hyphens)
- `payload` (object — may be `{}`)
- `timestamp` (optional number; ms)
- `requestGuid` (optional string — duplicates within ~5s are dropped after first ack)

Keepalive ping (plain text, not JSON): **`__KEEPALIVE__`** — consumed by the DO, no response.

### Server → client: `AssignIdentity`

Sent immediately after WebSocket handshake. **`playerGuid` is authoritative** for this connection; reuse it on every outbound envelope.

- `payload`: `{ playerId, playerName }` (same keys as Gilded Gloom `AssignIdentity`; guest / procedural names until auth exists)

### Server → clients: `MatchPresence`

Fan-out whenever a peer **joins or leaves**:

- **`playerGuid`**: equals the **subject’s** GUID (joined or left), not an empty sentinel.
- **`payload`**: `{ event: "joined" | "left", connectedCount, matchLevelId }`

Phase 1 uses stub id **`dev-default`** (`matchLevelId`). `joined` broadcasts include the newcomer; **`connectedCount`** is the active socket count **after** the join/leave is applied.

### Client → server: any typed message

 Parses like Gilded Gloom’s validator: malformed JSON skip; envelopes without `messageType` / `playerGuid` rejected; **`playerGuid`** must equal the session GUID. If **`requestGuid`** is present:

1. Duplicate within TTL → silently ignored (**no second** `RequestReceived`).
2. New → **`RequestReceived`** echoed with same `requestGuid`, then tracked.

Phase 1 does **not** route gameplay types yet (`RequestReceived` + validation only).
