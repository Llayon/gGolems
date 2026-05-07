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

### High-Level Architecture

```mermaid
graph TD
    subgraph App["Frontend (React 19)"]
        App_ts["App.tsx"]
        UI["ui/ — Lobby, HUD"]
        AppHooks["app/ — useGameSession, usePilotAccount"]
    end

    subgraph Engine["Game Engine (Composition Root)"]
        Engine["Engine.ts — class Game"]
        Renderer["Renderer — Three.js scene"]
        Network["NetworkManager — PeerJS"]
    end

    subgraph World["World Systems"]
        Arena["Arena.ts"]
        Terrain["TerrainBuilder + HeightmapSource"]
        Grass["GrassShaderSystem"]
        Trees["TreeSpawner + GroundCoverSpawner"]
        Props["WorldPropSystem + TerrainMasses"]
    end

    subgraph Entities["Game Entities"]
        Golem["GolemController — player mech"]
        Bot["DummyBot — AI"]
        Factory["GolemFactory"]
    end

    subgraph Runtime["Pure Runtime Modules (src/core/)"]
        BotRT["bots/BotRuntime"]
        CombatRT["combat/ProjectileCombatRuntime"]
        HitRT["combat/PlayerHitRuntime"]
        FxRT["combat/ProjectileCombatFxRuntime"]
        MatchRT["match/MatchRuntime"]
        MatchCtrl["match/MatchController"]
        NetRT["network/NetworkMessageRuntime"]
        NetSync["network/NetworkSyncAdapter"]
        RemPlayerRT["network/RemotePlayerLifecycleRuntime"]
        RespawnRT["respawn/RespawnRuntime"]
        SpawnSys["respawn/SpawnSystem"]
        WorldFxRT["world/WorldFxRuntime"]
    end

    subgraph Adapters["Context Factories"]
        RuntimeCtx["EngineRuntimeContexts.ts"]
        SessionCtx["EngineSessionRuntimeAdapters.ts"]
    end

    subgraph Integrations["External Services"]
        Firebase["Firebase — Lobby Registry"]
        Supabase["Supabase — Auth, Progression"]
    end

    App_ts --> AppHooks
    App_ts --> Engine
    AppHooks --> SessionCtx
    UI --> AppHooks
    UI --> App_ts

    Engine --> Renderer
    Engine --> Network
    Engine --> Arena
    Engine --> Golem
    Engine --> Bot
    Engine --> Factory
    Engine --> RuntimeCtx
    Engine --> SessionCtx
    Engine --> Firebase

    Arena --> Terrain
    Arena --> Grass
    Arena --> Trees
    Arena --> Props

    BotRT --> Bot
    CombatRT --> Golem
    HitRT --> Golem
    FxRT --> Props

    Engine --> BotRT
    Engine --> CombatRT
    Engine --> HitRT
    Engine --> FxRT
    Engine --> MatchRT
    Engine --> MatchCtrl
    Engine --> NetRT
    Engine --> NetSync
    Engine --> RemPlayerRT
    Engine --> RespawnRT
    Engine --> SpawnSys
    Engine --> WorldFxRT

    RuntimeCtx --> Engine
    SessionCtx --> Engine

    AppHooks --> Firebase
    AppHooks --> Supabase

    classDef engine fill:#f9d79b,stroke:#8a6d3b,color:#000
    classDef world fill:#a8d8a8,stroke:#4a7a4a,color:#000
    classDef entities fill:#a8c8f0,stroke:#3a5a8a,color:#000
    classDef runtime fill:#f0b0b0,stroke:#8a3a3a,color:#000
    classDef adapter fill:#d4b8e0,stroke:#6a3a7a,color:#000
    classDef integration fill:#e0d8b0,stroke:#7a6a3a,color:#000
    classDef app fill:#b0d4e8,stroke:#3a6a8a,color:#000

    class Engine,Renderer,Network engine
    class Arena,Terrain,Grass,Trees,Props world
    class Golem,Bot,Factory entities
    class BotRT,CombatRT,HitRT,FxRT,MatchRT,MatchCtrl,NetRT,NetSync,RemPlayerRT,RespawnRT,SpawnSys,WorldFxRT runtime
    class RuntimeCtx,SessionCtx adapter
    class Firebase,Supabase integration
    class App_ts,UI,AppHooks app
```

### Direction Rules

```mermaid
graph LR
    App["app/"] --> Engine["core/Engine.ts"]
    UI["ui/"] --> App
    UI --> I18N["i18n/"]
    Engine --> World["world/"]
    Engine --> Entities["entities/"]
    Engine --> Runtime["core/*Runtime.ts"]
    Engine --> Adapters["core/*Contexts.ts"]
    Entities --> Mechs["mechs/"]
    Entities --> Combat["combat/"]
    Runtime -- "pure functions, no imports from" -.->|❌| Entities
    Runtime -- "pure functions, no imports from" -.->|❌| World
    Runtime -- "pure functions, no imports from" -.->|❌| UI

    classDef layer fill:#f0e8d0,stroke:#8a7a5a,color:#000
    class App,UI,Engine,World,Entities,Runtime,Adapters,Mechs,Combat,I18N layer
```

- `src/core/**` → **never** imports from `src/entities/`, `src/world/`, `src/ui/`
- `Engine.ts` → imports runtime functions from `src/core/`, entities from `src/entities/`, world from `src/world/`
- `src/entities/` → imports from `src/core/`, `src/combat/`, `src/mechs/`
- `src/ui/` → imports from `src/app/`, `src/gameplay/`, `src/mechs/`, `src/i18n/`
- `src/app/` → imports from `src/core/Engine.ts`, `src/supabase/`, `src/firebase/`

## Per-Frame Update Order (game loop)

```mermaid
graph TD
    Loop["loop(time)"] --> dt["dt = min((time - lastTime) / 1000, 0.1)"]
    dt --> Physics["physics.step() — Rapier3D"]
    Physics --> TerrainUpdate["world.terrain.update() — LOD switch"]
    TerrainUpdate --> Camera["_updateCameraAndInput() — mouse, camera mode"]
    Camera --> Mechs["_updateMechs(dt) — local golem, remotes, decals, projectiles"]
    Mechs --> Bots["_updateBots(dt) — AI: move → engage → fire"]
    Bots --> ProjFx["_updateProjectilesAndFx() — aim point"]
    ProjFx --> Input["_handleInputActions() — fire groups, dash, vent"]
    Input --> CP["_updateControlPoints(dt) — capture scoring"]
    CP --> Combat["_updateCombatAndRespawn(dt) — collisions, impact FX, respawn waves"]
    Combat --> Particles["_updateParticlesAndProps(dt) — particles, debris, atmosphere"]
    Particles --> NetTick["_updateNetworkTick(dt) — host broadcast / client input"]
    NetTick --> Render["renderer.render() — Three.js frame"]

    classDef step fill:#f0e8d0,stroke:#8a7a5a,color:#000
    class Loop,dt,Physics,TerrainUpdate,Camera,Mechs,Bots,ProjFx,Input,CP,Combat,Particles,NetTick,Render step
```

### Data Flow per Step

| Step | Reads | Writes | Side Effects |
|------|-------|--------|--------------|
| `physics.step()` | — | Rapier3D world state | Collision detection |
| `terrain.update()` | Camera position | LOD level visibility | Mesh add/remove |
| `_updateCameraAndInput()` | Mouse delta, keys | Camera mode, yaw/pitch | — |
| `_updateMechs(dt)` | Golem input, remote snapshots | Mech position, rotation, decals | Sound, particle spawn |
| `_updateBots(dt)` | Bot positions, objective nodes | Bot movement, fire requests | Bot weapon fire |
| `_updateProjectilesAndFx()` | Camera, aim | Aim target point | — |
| `_handleInputActions()` | Input buffer | Golem weapon fire state | Weapon projectiles |
| `_updateControlPoints(dt)` | Golem/bot positions | Point ownership, team scores | Match scoring |
| `_updateCombatAndRespawn()` | Projectile positions, dead units | HP, respawn timers, death tracking | Impact FX, spawn waves |
| `_updateParticlesAndProps()` | dt, prop positions | Particle state, prop FX | Steam, fire, debris |
| `_updateNetworkTick()` | Engine state, remote players | Network packets | WebRTC send/receive |
| `renderer.render()` | Scene state | Screen pixels | GPU draw calls |

## Runtime Module Pattern

All `*Runtime.ts` files are **pure functions** that take a context interface and operate without side effects beyond the context:

```mermaid
graph LR
    subgraph Engine["Engine.ts (per frame)"]
        E["loop() calls runtime(ctx, dt)"]
    end

    subgraph Adapters["Context Factories"]
        RF["EngineRuntimeContexts.ts"]
        SF["EngineSessionRuntimeAdapters.ts"]
    end

    subgraph Runtime["Pure Functions"]
        BR["BotRuntime.ts"]
        PCR["ProjectileCombatRuntime.ts"]
        PHR["PlayerHitRuntime.ts"]
        MR["MatchRuntime.ts"]
        RR["RespawnRuntime.ts"]
        NSR["NetworkSyncAdapter.ts"]
    end

    E -->|"ctx = RF.projectileCombat()| PCR
    E -->|"ctx = SF.bot()| BR
    E -->|"ctx = RF.playerHit()| PHR
    E -->|"ctx = RF.controlMatch()| MR
    E -->|"ctx = RF.respawn()| RR
    E -->|"ctx = RF.networkSync()| NSR
    RF -->|"reads Engine state| E
    SF -->|"reads Engine state| E

    classDef engine fill:#f9d79b,stroke:#8a6d3b,color:#000
    classDef adapter fill:#d4b8e0,stroke:#6a3a7a,color:#000
    classDef runtime fill:#f0b0b0,stroke:#8a3a3a,color:#000
    class E engine
    class RF,SF adapter
    class BR,PCR,PHR,MR,RR,NSR runtime
```

### Adapter Flow (Sequence)

```mermaid
sequenceDiagram
    participant Loop as Engine.loop()
    participant Ctx as EngineRuntimeContexts
    participant RT as *Runtime.ts
    participant State as Engine state (golems, bots, etc.)

    Loop->>Ctx: ctx = ctxFactory.projectileCombat()
    Ctx->>State: read projectile positions, units, terrain
    Ctx-->>Loop: return ProjectileCombatContext
    Loop->>RT: updateProjectileCollisions(ctx, dt)
    RT->>State: mutate HP, spawn impact FX (via callbacks)
    RT-->>Loop: return (void)
```

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

## Network Flow (Host ↔ Client)

```mermaid
sequenceDiagram
    participant Client
    participant PeerJS as PeerJS (WebRTC)
    participant Host

    Client->>Host: input packet (keyboard, mouse)
    Host->>Host: process inputs → game logic
    Host->>Host: physics.step() + bot AI + combat
    Host->>Client: authoritative state snapshot
    Client->>Client: interpolate remote players
    Host->>Host: broadcast next tick
```

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
