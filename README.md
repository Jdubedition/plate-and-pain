# Plate & Pain

## Required FAB Packages

Install the following FAB packages before working with this project:

- [Abandoned Cathedral](https://fab.com/s/38d31865c90f)
- [Ultra Dynamic Sky](https://fab.com/s/77a632ad8b62)
- [Essential Sword & Shield Animation Pack](https://fab.com/s/c6c7636e6617)
- [Monster AI Toolkit](https://fab.com/s/8758f4171757)
- [Quixel Stone Surface](https://fab.com/s/4451bc0d24c1)
- [Melee Weapon Sound Effects Pack 2](https://fab.com/s/d4b79bcf1708) Push to 5.5 then migrate WAV
- [Dark Knight - Male and Female](https://fab.com/s/b03de798c900)
- [Round Shield](https://fab.com/s/2a385caacd5b)

## Server (Workers + MatchLevel)

Development WebSocket backend lives in **`server/`**:

```bash
cd server && npm install && npm run dev
```

Runs on port **`8787`**. UE should connect with **`ws://127.0.0.1:8787/connect`**. Brief protocol reference: [`server/README.md`](server/README.md).

---

## Server implementation roadmap

Higher-level phases beyond the Phase 1 scaffold in `server/` (create/join, AI pawns, replication, production hardening):

1. **Match lifecycle (boom-game–style Sessions + routing)** — HTTP entry stays on the Worker; introduce a global **Sessions** Durable Object for every WebSocket; **MatchLevel** stubs **`idFromName(matchId)`** (or a dedicated level id) per active match; message flow for **`CreateMatch` / `JoinMatch`** (code or opaque id); **`match_codes`** (or equivalent) keyed lookup (often SQLite on Sessions); optional **`DEV_MODE`** fixed short code (e.g. `XXXX`) for local convenience.
2. **Authoritative player + AI pawn mapping** — On join, assign **one** server-owned **AI pawn / character id** per human player (persist on **MatchLevel** SQLite); emit **`AiAssigned`** (or same envelope family) mapping **`playerGuid → aiEntityId`**; generalize to multiple AI per player later.
3. **Replication envelopes (Gilded Gloom–style routing)** — Add `types.ts` enums, **`messageRouter.ts`**, and handlers for **transform** (`position`, `rotation`, optional velocity), **`AiAction` / `PlayerIntent`** passthrough payloads; **`broadcastToOthers`** semantics for fan-out; optional interest / level groups if scale requires it.
4. **Operational hardening** — Auth (passwordless / JWT on WebSocket), inactive connection cleanup, HTTP rate limits, **`wrangler deploy`**, observability — mirror patterns from the Gilded Gloom server where they fit this game.

See [`server/README.md`](server/README.md) for the wire protocol implemented today.
