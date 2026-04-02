# Networking Reference

> Status: Canonical reference  
> Scope: Current gameplay transport, lobby discovery, and backend boundaries.

## Purpose

Explain which service owns what, how gameplay networking works, and where the authoritative state model lives.

## Current Architecture and Responsibilities

- `src/network/NetworkManager.ts` is the low-level `PeerJS` wrapper for live gameplay connections.
- `src/core/network/` owns gameplay DTOs, authoritative snapshot build/apply, message dispatch, transport sync, and remote-player lifecycle.
- `src/firebase/` is an optional public lobby registry only. It does not carry live gameplay state.
- `src/supabase/` is an optional pilot account/progression layer. It does not carry live gameplay transport.

## Key Contracts, Types, or Interfaces

- Clients send input packets to the host.
- Hosts build and broadcast authoritative state messages.
- Runtime message categories include:
  - authoritative state
  - client input
  - respawn
  - restart match
  - fire
  - hit confirm
- `NetworkStartupError` in `src/network/NetworkManager.ts` is the UI-facing startup error shape.

## Data Flow and Runtime Flow

### Gameplay Transport

1. Host starts `NetworkManager.initAsHost()`.
2. Client starts `NetworkManager.initAsClient(hostId)`.
3. Clients send input DTOs.
4. Host updates the world and builds authoritative player snapshots.
5. Snapshot/apply runtimes update local and remote actors from plain DTOs.
6. Remote-player lifecycle runtime creates, replaces, or removes remote mechs as needed.

### Firebase Public Lobby

- The room browser is enabled only when all `VITE_FIREBASE_*` values are present.
- Hosts register a small heartbeat/metadata record.
- Clients can still join manually by host ID even when Firebase is disabled.

### Supabase Backend

- Supabase is enabled only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present.
- It stores pilot profile/progression and recent match data.
- The optional `finish-match` Edge Function is a progression/persistence path, not gameplay authority.

## Extension Points

- Add new gameplay message types in `src/core/network/` and keep them DTO-first.
- Add new lobby metadata via Firebase without making Firebase authoritative for combat state.
- Add richer progression/account features in Supabase without routing frame-by-frame combat through it.

## Validation and Failure Modes

- Run `npm run test:runtime-smoke` after message schema, lifecycle, or respawn changes.
- Do a manual host/client join smoke test after any transport or lobby change.
- If Firebase or Supabase begins carrying authoritative combat state, the architecture boundary has regressed.
- If runtime networking logic bypasses the DTO/apply path and mutates actors ad hoc, the boundary has regressed.

## Related Documents

- [runtime-reference.md](runtime-reference.md)
- [firebase-lobby-setup.md](firebase-lobby-setup.md)
- [supabase-setup.md](supabase-setup.md)
- [testing-and-validation.md](testing-and-validation.md)
