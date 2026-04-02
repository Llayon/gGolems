# Runtime Reference

> Status: Canonical reference  
> Scope: Current session/runtime architecture in `src/core/`.

## Purpose

Document how the live game session is built, updated, synchronized, and torn down today.

## Current Architecture and Responsibilities

- `src/core/Engine.ts` is the composition root for a live session.
- `src/core/EngineRuntimeContexts.ts` builds explicit combat/network/world adapters.
- `src/core/EngineSessionRuntimeAdapters.ts` builds explicit authoritative, respawn, remote lifecycle, and bot adapters.
- `src/core/network/` holds DTO builders, message dispatch/apply logic, transport sync helpers, and remote-player lifecycle logic.
- `src/core/combat/` holds projectile updates, hit resolution, and combat FX split by responsibility.
- `src/core/respawn/`, `src/core/bots/`, `src/core/match/`, and `src/core/world/` isolate respawn waves, bots, score/control logic, and prop/world FX.

## Key Contracts, Types, or Interfaces

- `GameHudState` is the published runtime snapshot for UI.
- `SessionMode` is `solo`, `host`, or `client`.
- `NetworkPosition` and related DTOs in `src/core/network/` are the plain-data boundary between transport and runtime mutation.
- Runtime smoke coverage lives in `src/core/runtimeSmoke/runRuntimeSmoke.ts`.

## Data Flow and Runtime Flow

### Session Startup

1. `useGameSession` calls `initGame`.
2. `initGame` creates the `Game` instance in `Engine.ts`.
3. The `Game` instance creates renderer, physics, world, local mech, runtime adapters, and the low-level `NetworkManager`.
4. `useGameSession` optionally starts host/client networking after the world exists.

### Frame Update Order

The runtime contract is:

1. read input
2. update local mech
3. update remote mechs
4. update bots
5. update projectiles and resolve collisions
6. update match/control logic
7. apply FX and world events
8. build and send network data
9. build HUD state
10. render the frame

### Teardown

`Game.stop()` is responsible for runtime teardown. `useGameSession` owns the UI/session side of leaving a match and releasing pointer lock.

## Extension Points

- Add runtime systems by extending `src/core/<domain>/` and wiring them through adapter factories, not by growing `Engine.ts`.
- Add message types by extending the DTO/message runtime path in `src/core/network/`.
- Add new match logic through `src/core/match/` and `src/gameplay/` without bypassing `GameHudState`.

## Validation and Failure Modes

- Run `npm run test:runtime-smoke` after runtime/session/network changes.
- Run `npm run lint` and `npm run build` after any `src/core/` refactor.
- Do a manual host/client or solo smoke pass when changing update order, respawn, networking, or HUD state publication.
- If runtime code starts importing React/UI modules, the architecture boundary has regressed.

## Related Documents

- [architecture-overview.md](architecture-overview.md)
- [networking-reference.md](networking-reference.md)
- [testing-and-validation.md](testing-and-validation.md)
