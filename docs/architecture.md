# Architecture & Subsystem Map

> Auto-generated reference for LLM context. Shows dependencies, data flow, and update order.

## Subsystem Overview

```
src/
├── app/                          # React hooks, session management, pilot accounts (4 files, ~594 lines)
├── core/                         # Game engine core — pure functions + adapters (32 files, ~5665 lines)
│   ├── bots/                     # Bot AI, movement targets, snapshots (2 files)
│   ├── combat/                   # Projectile hit logic, FX, combat rules (4 files)
│   ├── match/                    # Scoring, game mode settings, team overview (2 files)
│   ├── network/                  # Network sync, message runtime, remote players (7 files)
│   ├── respawn/                  # Respawn waves, spawn points, death tracking (3 files)
│   ├── runtimeSmoke/             # Smoke tests (2 files)
│   └── world/                    # World FX runtime (1 file)
├── entities/                     # Golem controllers, DummyBot, factory (6 files, ~1502 lines)
├── world/                        # Arena, terrain, trees, grass, props (16 files, ~4063 lines)
├── mechs/                        # Chassis definitions, loadouts, rules, runtime (16 files, ~2126 lines)
├── combat/                       # Weapon definitions, profiles, projectile types (3 files, ~548 lines)
├── gameplay/                     # Control points, game mode types (2 files, ~441 lines)
├── network/                      # NetworkManager (PeerJS wrapper) (1 file, ~157 lines)
├── camera/                       # Third-person + orbit camera (1 file, ~299 lines)
├── fx/                           # Debris, particles, impact effects (4 files, ~659 lines)
├── ui/                           # React components: lobby, HUD (6 files, ~431 lines)
├── i18n/                         # Localization: en, ru, key maps (5 files, ~653 lines)
├── supabase/                     # Auth, profile, progression (7 files, ~561 lines)
├── firebase/                     # Lobby registry, rooms (2 files, ~287 lines)
├── utils/                        # Quality profiles, helpers (3 files, ~155 lines)
└── assets/                       # Asset loaders (GLTF, textures) (0 files)
```

## Dependency Graph (imports)

```
                    ┌─────────────┐
                    │   Engine.ts │  ← Composition root (class Game)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────────┐
    │ Renderer │    │  World   │    │NetworkManager│
    │ (Three)  │    │(Arena)   │    │  (PeerJS)    │
    └──────────┘    └────┬─────┘    └──────┬───────┘
                         │                 │
          ┌──────────────┼──────┐          │
          ▼              ▼      ▼          ▼
    ┌──────────┐  ┌────────┐ ┌─────┐ ┌──────────┐
    │ Terrain  │  │TreeSpwn│ │Grass│ │ Firebase │
    │ Grass    │  │GrndCvr │ │     │ │ LobbyReg │
    └──────────┘  └────────┘ └─────┘ └──────────┘

    ┌──────────────────────────────────────────────────────┐
    │              src/core/  (pure functions)              │
    ├──────────┬──────────┬──────────┬──────────┬──────────┤
    │  bots/   │ combat/  │  match/  │ network/ │ respawn/ │
    │BotRuntime│ProjCombat│MatchCtrl │NetSync   │SpawnSys  │
    └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
    ┌──────────────────────────────────────────────────────┐
    │           EngineSessionRuntimeAdapters.ts            │
    │         (factory: binds Engine state → contexts)      │
    └──────────────────────────────────────────────────────┘
```

### Direction Rules
- `src/core/**` → **never** imports from `src/entities/`, `src/world/`, `src/ui/`
- `Engine.ts` → imports runtime functions from `src/core/`, entities from `src/entities/`, world from `src/world/`
- `src/entities/` → imports from `src/core/`, `src/combat/`, `src/mechs/`
- `src/ui/` → imports from `src/app/`, `src/gameplay/`, `src/mechs/`, `src/i18n/`
- `src/app/` → imports from `src/core/Engine.ts`, `src/supabase/`, `src/firebase/`

## Per-Frame Update Order (game loop)

```
loop(time)
  └── dt = min((time - lastTime) / 1000, 0.1)
  └── physics.step()                           ← Rapier3D physics step
  └── world.terrain.update()                   ← LOD controller switch
  └── _updateCameraAndInput()                  ← Mouse delta, camera mode toggle
  └── _updateMechs(dt)                         ← Local golem, remote players, decals, sounds
  │    └── localGolem.update(dt)               ←   Movement, rotation, weapon fire requests
  │    └── remotePlayers.sync()                ←   Network interpolation
  │    └── decals.update(dt)                   ←   Impact marks
  │    └── projectileManager.update(dt)        ←   Projectile positions, trails
  └── _updateBots(dt)                          ← Bot AI: move → engage → fire
  │    └── updateBotsRuntime(context, dt)      ←   Pure function, uses BotRuntimeContext
  └── _updateProjectilesAndFx()                ← Aim point calculation
  └── _handleInputActions()                    ← Consume fire groups, dash, vent
  └── _updateControlPoints(dt)                 ← Capture scoring, dominance
  └── _updateCombatAndRespawn(dt)              ← Projectile collisions, impact FX, respawn waves
  └── _updateParticlesAndProps(dt)             ← Boiler particles, debris, atmosphere, props
  └── _updateNetworkTick(dt)                   ← Host: broadcast snapshots, Client: send input
  └── renderer.render()                        ← Three.js render frame
```

## Runtime Module Pattern

All `*Runtime.ts` files are **pure functions** that take a context interface and operate without side effects beyond the context:

| File | Function | Purpose |
|------|----------|---------|
| `core/bots/BotRuntime.ts` | `updateBots(ctx, dt, mode, ended)` | Bot AI update loop |
| `core/bots/BotRuntime.ts` | `syncTeamBotRoster(ctx)` | Spawn/despawn bots per team |
| `core/bots/BotRuntime.ts` | `buildBotSnapshots(bots)` | Serialize bot state for network |
| `core/combat/ProjectileCombatRuntime.ts` | `updateProjectileCollisions(ctx, dt)` | Hit detection, damage |
| `core/combat/ProjectileCombatRuntime.ts` | `fireWeaponRequestsRuntime(ctx, ownerId, requests, aim)` | Fire weapons |
| `core/combat/PlayerHitRuntime.ts` | `applyDamageToPlayer(ctx, attacker, target, dmg)` | Apply damage to remote players |
| `core/combat/ProjectileCombatFxRuntime.ts` | `playWeaponVolleyFxRuntime(ctx, shots)` | Trigger weapon VFX |
| `core/match/MatchRuntime.ts` | `updateControlMatch(ctx, dt)` | Control point scoring |
| `core/match/MatchRuntime.ts` | `buildTeamOverview(ctx)` | Team score/state snapshot |
| `core/match/MatchController.ts` | `applyGameModeSettings(ctx, mode)` | Mode-specific config |
| `core/network/NetworkMessageRuntime.ts` | `handleHostMessageRuntime(ctx, msg)` | Process client input packets |
| `core/network/NetworkMessageRuntime.ts` | `buildClientInputPacket(ctx)` | Serialize client input |
| `core/network/NetworkSyncAdapter.ts` | `broadcastHostSnapshot(ctx)` | Send authoritative state |
| `core/network/RemotePlayerLifecycleRuntime.ts` | `syncRemotePlayerSpawns(ctx)` | Spawn remote players on clients |
| `core/respawn/RespawnRuntime.ts` | `updateRespawns(ctx, dt)` | Respawn timer, wave scheduling |
| `core/respawn/RespawnRuntime.ts` | `queueLocalRespawn(ctx)` | Mark local player for respawn |
| `core/respawn/SpawnSystem.ts` | `resolveTeamSpawn(ctx)` | Find valid spawn point |
| `core/world/WorldFxRuntime.ts` | `updateWorldPropFx(ctx, dt)` | Prop-based effects (steam, fire) |

## Adapter Pattern

### EngineRuntimeContexts.ts
Factory methods that build **context objects** for pure runtime functions. Each factory reads state from `Engine` and returns a plain object matching a context interface:

- `projectileCombat()` → `ProjectileCombatContext`
- `playerHit()` → `PlayerHitContext`
- `combatFx()` → `ProjectileCombatFxContext`
- `weaponFire()` → `WeaponFireContext`
- `controlMatch()` → `ControlMatchContext`
- `matchTeam()` → `TeamOverviewContext`
- `worldFx()` → `WorldFxContext`
- `respawn()` → `RespawnContext`
- `spawn()` → `SpawnContext`
- `networkMessage()` → `NetworkMessageContext`
- `networkSync()` → `NetworkSyncContext`
- `remotePlayer()` → `RemotePlayerContext`
- `unitLocator()` → `UnitLocatorContext`
- `matchController()` → `MatchControllerContext`

### EngineSessionRuntimeAdapters.ts
Factory methods for **session-level** contexts that depend on session mode (solo/host/client):

- `bot()` → `BotRuntimeContext` — bots map, team size, spawn slots, create/destroy callbacks
- `controlPoints()` → `ControlPointRuntimeContext` — point positions, capture state

## External Dependencies

| Package | Version | Used By | Purpose |
|---------|---------|---------|---------|
| `three` | 0.183.2 | Renderer, World, Entities, FX, Camera | 3D rendering |
| `@dimforge/rapier3d-compat` | 0.19.3 | Engine, TerrainBuilder, Arena | Physics/collision |
| `peerjs` | 1.5.5 | NetworkManager | WebRTC P2P networking |
| `react` | 19.0.0 | App, UI components | Frontend framework |
| `firebase` | 12.11.0 | Firebase lobby registry | Real-time room listing |
| `@supabase/supabase-js` | 2.101.0 | Supabase auth/progress | Pilot accounts, progression |
| `@google/genai` | 1.29.0 | (legacy, not required) | AI features |

## Key Invariants

1. **No direct mutation in runtime functions** — `*Runtime.ts` functions only mutate through context callbacks
2. **Bot AI runs on host only** — `sessionMode !== 'client'` guard in `BotRuntime.ts`
3. **Network is host-authoritative** — host broadcasts state, clients send inputs
4. **Physics runs before game logic** — `physics.step()` is first in loop
5. **Terrain height sampling is pure** — `sampleHeight(x, z)` has no side effects
6. **Asset loading is non-blocking** — `initAsync` fires and forgets for trees/ground cover

## Changing Subsystems

When modifying a subsystem, check these for potential impact:

| If changing... | Also check... |
|---------------|---------------|
| `Engine.ts` loop order | `_updateMechs`, `_updateBots`, `_updateCombatAndRespawn` — order matters for causality |
| `BotRuntime.ts` | `DummyBot.ts` update method, `BotObjectiveSystem.ts` target calculation |
| `ProjectileCombatRuntime.ts` | `ProjectileManager.ts` FX, `GolemController.ts` damage handler |
| `TerrainBuilder.ts` | `HeightmapSource.ts`, `TerrainMasses.ts`, `Arena.surfaceY()` |
| Network message format | `NetworkMessageRuntime.ts`, `NetworkSyncAdapter.ts`, client-host compatibility |
| Weapon definitions | `combat/weaponTypes.ts`, `mechs/` loadout rules, `ProjectileManager.ts` |
| Control point logic | `ControlPointManager.ts`, `MatchRuntime.ts`, `BotObjectiveSystem.ts` |
