# Engine Refactor Plan v5

## Goal
Reduce [Engine.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/Engine.ts) from a god-class into a thin orchestration layer without changing gameplay behavior, network authority, or frame order.

Success means:

- explicit ownership of mutable state
- pure logic extracted before side-effect systems
- shared contracts between runtime and UI
- `Game` coordinates systems instead of implementing them inline

## Non-Goals
This refactor does **not**:

- rewrite rendering to `react-three-fiber`
- redesign combat math
- change physics authority
- change frame update order
- change packet schema unless the pass explicitly targets networking compatibility

## Frame Update Contract
The following order is the runtime contract and must not change during structural refactors:

1. read input
2. update local mech
3. update remote mechs
4. update bots
5. update projectiles and resolve collisions
6. update prop/control-point match logic
7. update particles, decals, debris, and world runtime
8. build/send network snapshots
9. build HUD state
10. render frame

If a future change needs a different order, that is a gameplay decision, not a refactor side effect.

## State Ownership
- `App` owns UI state only.
- `Game` owns orchestration, top-level references, and frame order.
- Pure modules compute data and return outputs.
- Runtime adapters apply side effects, but must not become new god-objects.

## Mutable Ownership Table
- `remotePlayers`
  - owner: `Game`
  - may be mutated by: networking runtime path only
- `bots`
  - owner: `Game`
  - may be mutated by: bot runtime path only
- `teamScores`
  - owner: match flow path
  - may be mutated by: control/tdm scoring path only
- `respawnWaves`
  - owner: respawn path
  - may be mutated by: respawn runtime only
- `controlPoints`
  - owner: control-point runtime
  - may be mutated by: match/control logic only
- `RigidBody` translations / velocities
  - owner: mech, bot, respawn, and networking apply paths
  - must never be mutated from UI or pure helper modules

## Import Rules
- `App` must not import runtime internals beyond shared contracts.
- Pure modules must not import `THREE`, `RAPIER`, DOM APIs, or `NetworkManager`.
- Runtime adapters must not import React components or UI modules.
- Shared contracts may be imported by both UI and runtime.

## DTO / Serialization Boundary
- Pure extraction modules must operate on plain typed data objects only.
- Snapshot builders should return serializable DTOs, not runtime objects.
- Snapshot apply helpers may prepare apply plans from DTOs, but must not own scene mutation.
- `THREE.Vector3`, `RAPIER` bodies, `GolemController`, and `NetworkManager` stay outside pure modules.

## Allocation Discipline
- Structural refactors must not introduce avoidable allocation spikes inside hot update paths.
- Pure builders should prefer plain objects, reuse caller-provided buffers where practical, and avoid per-tick `new THREE.Vector3()` or similar runtime-heavy objects.
- If an extraction needs extra allocation for clarity, measure whether it sits on a per-frame or per-event path and keep the cost explicit.

## Anti-Patterns
Avoid:

- moving one large method into one equally large "system" class
- mixing `build` and `apply` logic in the same extraction
- mixing DTO construction with runtime mutation in the same helper
- hidden reads from `Game` state inside helper modules
- utility files that know too much about unrelated systems
- class explosion where a small typed function would be sufficient
- extracting code while quietly changing host/client authority behavior
- introducing extra per-frame allocation in a previously flat hot path
- multi-subsystem refactors in one pass

## Migration Phases

### Phase 1: Shared Contracts
Move duplicated state shapes out of `Engine.ts` and `App.tsx`.

Done:
- `src/core/gameHudState.ts`
- `src/core/buildGameHudState.ts`

Next:
- player snapshot types
- respawn state types
- bot decision input/output types

Definition of done:
- no duplicated HUD or snapshot shapes between `App` and `Engine`
- extracted files can be imported without runtime side effects

### Phase 2: Pure Extracts
Extract decision logic that can run without scene mutation.

Priority order:
1. `buildAuthoritativePlayerSnapshots`
2. `buildClientInputPacket`
3. `buildRadarContacts`
4. `resolveRespawnWave`
5. `pickBotPriorityTarget`

Definition of done:
- output depends only on explicit parameters
- no `scene.add`, `body.setTranslation`, `network.send`, or similar side effects
- no `THREE`, `RAPIER`, or controller instance requirements in the pure module API
- no direct reads from hidden `Game` internals

### Phase 3: Runtime Apply / Adapters
Only after pure builders exist, extract side-effect paths.

Priority order:
1. `reconcileRemotePlayerSet`
2. `applyAuthoritativeLocalPlayerState`
3. `applyAuthoritativeRemotePlayerState`
4. `RemotePlayerLifecycleRuntime`
5. `NetworkSyncAdapter`
6. `RespawnRuntime`
7. `BotRuntime`
8. `ProjectileCombatRuntime`

Definition of done:
- runtime adapters mostly call extracted pure helpers
- side effects are localized
- adapter APIs are narrower than `Game`
- host/client responsibilities are clearer after extraction, not more implicit

### Phase 4: Composition Root
Shrink `Game` into a coordinator that:

- gathers frame inputs
- invokes systems in order
- owns shared references
- publishes HUD state

Definition of done:
- `Game` reads like an update script
- most subsystem logic lives outside `Game`

### Phase 5: Cleanup / Convergence
After migrations are stable, remove temporary shims and dead inline paths.

Definition of done:
- old inline branches are deleted, not merely bypassed
- `Game` no longer exposes migration-only helper APIs that adapters do not need
- duplicate logic between new modules and old inline code is removed
- the final structure is simpler to read than the transitional one

## Network Compatibility Rules
- packet and snapshot schema changes must be intentional, never incidental
- if a pass changes snapshot fields, fallback behavior must be preserved where practical
- `buildAuthoritativePlayerSnapshots` and runtime apply paths should be extracted separately
- client input packet building should be isolated from host authoritative snapshot building
- remote player lifecycle decisions should be separated from per-player state application
- networking refactors should prefer compatibility shims over same-pass protocol rewrites

## Per-Pass Scope Limits
- one pass should target one subsystem path
- do not combine `network + bots + respawn` in a single extraction
- do not mix structural extraction with combat rebalance
- if a pass requires schema change plus runtime application plus UI change, split it into separate steps
- within networking, treat `build`, `reconcile`, `apply`, and `lifecycle` as separate paths unless the extracted code is trivial

## Validation Per Phase
Every extraction pass must preserve:

- `npm run lint`
- `npm run build`
- same match start flow
- same local/remote authority behavior
- same visible combat behavior in smoke scenarios
- no obvious allocation regressions in per-frame runtime paths

Pure phases should be checked for deterministic input/output shape. Runtime phases should be checked in-game.

## Manual Smoke Matrix
Run these after runtime-facing passes:

1. solo start
2. host start
3. client join
4. remote player movement sync
5. remote fire sync
6. local respawn
7. remote respawn
8. bot target switching
9. control-point scoring
10. chassis/loadout sync for remote player
11. remote player disconnect cleanup
12. remote chassis/loadout mismatch replacement without stale visuals

## File Targets

### Near-Term
- `src/core/gameHudState.ts`
- `src/core/buildGameHudState.ts`
- `src/core/network/playerSnapshots.ts`
- `src/core/network/clientInputPacket.ts`
- `src/core/network/reconcileRemotePlayers.ts`
- `src/core/network/applyAuthoritativePlayerState.ts`
- `src/core/respawn/respawnLogic.ts`
- `src/core/bots/botDecisionLogic.ts`

### After That
- `src/core/network/RemotePlayerLifecycleRuntime.ts`
- `src/core/network/NetworkSyncAdapter.ts`
- `src/core/respawn/RespawnRuntime.ts`
- `src/core/bots/BotRuntime.ts`
- `src/core/combat/ProjectileCombatRuntime.ts`

## Measurable Targets
- after Phase 2, host snapshot building and client input packet building both exist outside `Engine.ts`
- after Phase 3, `Game` no longer owns inline remote-player reconciliation or authoritative remote-player apply
- after Phase 4, `Game` should read primarily as orchestration with substantially less inline subsystem branching
- target size for [Engine.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/Engine.ts): below `1200` lines after the main networking/respawn extractions, then below `900` lines as a longer-term goal

## Recommended Next Step
Next pass should extract:

1. `buildAuthoritativePlayerSnapshots`
2. `buildClientInputPacket`
3. `reconcileRemotePlayerSet`

Reason:
- networking is currently the densest organizational hotspot
- mech registry and loadout sync already increased snapshot complexity
- splitting `build`, `reconcile`, and `apply` enforces the architecture the later refactor depends on
