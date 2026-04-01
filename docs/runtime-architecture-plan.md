# Runtime Architecture Plan v5

## Goal
Move the project from a "better organized monolith" to a layered runtime that scales to more mechs, loadouts, and networked gameplay without turning `Engine` or `GolemController` into new god-objects.

This plan complements `docs/engine-refactor-plan.md`. That document shrinks `Engine`; this one fixes the next hotspot: mech architecture and layer boundaries around runtime, UI, and legacy networking code.

## Current Problems
- `src/entities/GolemController.ts` still owns too much: mech rules, movement, weapons, camera hooks, section damage, recoil, and hero visual logic.
- `src/core/EngineRuntimeContexts.ts` improves readability, but still depends directly on `Game` and acts like a service locator.
- `src/App.tsx` still contains large desktop combat presentation blocks.
- Old placeholder layers still exist in `src/network/SyncManager.ts` and `src/network/StateSerializer.ts`.
- Some runtime modules still cross the DTO/runtime boundary and allocate `THREE.Vector3` in update paths.

## Non-Goals
- No rewrite to `react-three-fiber`.
- No gameplay rebalance during structural passes.
- No packet schema redesign unless a pass explicitly targets networking.
- No visual asset pipeline changes as part of this refactor.

## Rules
- Extract contracts before extracting side effects.
- Prefer pure typed modules over broad classes.
- New modules must not depend on `Game` unless they are composition-root glue.
- Pure mech rules must not import `THREE`, `RAPIER`, audio, decals, or camera code.
- One pass targets one subsystem path only.

## Per-Pass Scope Limits
- One pass should target one mech subsystem path only.
- Do not mix `steam rules` and `movement runtime split` in the same pass.
- Do not mix `GolemController` extraction and `EngineRuntimeContexts` cleanup in the same pass.
- One commit should have one architectural purpose.
- If a pass needs rules extraction, runtime apply changes, and UI changes, split it into separate steps.

## Mech Update Contract
The internal order of mech update work must not change as a side effect of this refactor:

1. read control input or replicated target state
2. evaluate pure mech rules
3. apply movement or physics
4. build and consume weapon fire decisions
5. apply damage and section state changes
6. update camera hooks
7. update visual sync and animation state

If a later design needs a different order, that is a gameplay decision and must be handled explicitly.

## Authority Rules
- local control path is authoritative for:
  - `throttle`
  - local movement intent
  - local torso aim intent
- remote replication path is authoritative for:
  - replicated `targetPos`
  - replicated `targetLegYaw`
  - replicated `targetTorsoYaw`
- damage and section rules are authoritative for:
  - `sections`
  - `hp`
  - `maxHp`
  - mount disable state
- steam and weapon rules are authoritative for:
  - `steam`
  - `isOverheated`
  - `overheatTimer`
  - `cooldownRemaining`
- visual drivers may read gameplay state, but must not decide gameplay state

## Mech State Ownership
- `sections`, `hp`, `maxHp`
  - owner: mech damage or section rules
- `steam`, `maxSteam`, `isOverheated`, `overheatTimer`
  - owner: mech heat and steam rules
- `weaponMounts`, `cooldownRemaining`, `weaponRecoil`
  - owner: mech weapon runtime
- `targetPos`, `targetLegYaw`, `targetTorsoYaw`
  - owner: local input path or remote replication path
- `heroVisual`, animation actions, sockets, procedural gait state
  - owner: mech visual driver only
- `gameCamera` hooks
  - owner: mech-to-camera adapter only

No single module should own all of the above after the split.

## Runtime Asset Contract
Every mech visual integrated into gameplay must preserve the same minimum runtime contract:
- sockets:
  - `viewAnchor`
  - `leftArmMount`
  - `rightArmMount`
  - `torsoMount`
- section mapping compatible with the gameplay damage model
- stable mount ids compatible with loadout definitions
- movement and torso visual state that can be driven without custom per-mech gameplay code

This contract must stay stable while refactoring mech code.

## Allocation Discipline
- pure mech rules operate on plain typed DTOs only
- no `new THREE.Vector3()` or similar runtime-heavy allocation inside pure mech rules
- visual and replication helpers should reuse vectors where practical on per-frame paths
- extraction must not increase allocation churn in movement, replication, or visual sync loops

## Dependency Rules
- `MechVisualDriver` must not import weapon legality, steam rules, or damage rules
- `MechWeaponRuntime` must not import camera, audio, decals, or HUD modules
- `RemoteMechReplicationRuntime` must not import UI or presentation modules
- `LocalMechMovementRuntime` must not own section or loadout legality
- mech rules modules must not import `GolemController`

## Anti-Patterns
Avoid:
- replacing one large `GolemController` with one equally large runtime class
- pure helpers that still read from a live `GolemController`
- visual drivers that mutate gameplay state
- movement runtimes that also own weapon legality or section damage
- modules that import `Game` or `App` outside orchestration glue
- hidden `THREE.Vector3` allocation in per-frame pure or replication helpers
- mixing local-control and remote-replication logic in the same extraction unless the shared part is trivial
- leaving duplicate old and new mech logic alive for more than one migration phase

## Migration Compatibility Rules
- Transitional shims are allowed, but only for one phase at a time.
- A new authoritative path must delete the old inline path before the phase is considered complete.
- Do not keep two authoritative implementations of the same mech rule alive in parallel.
- `GolemController` may temporarily act as a facade over old and new logic, but only while a phase is in flight.
- If a migration requires temporary duplication, mark the old path for removal in the same phase.

## Phase 1: Mech Contracts First
Create explicit state and IO contracts:
- `MechRuntimeState`
- `MechControlInput`
- `MechWeaponState`
- `MechVisualState`
- `MechDamageState`

Target files:
- `src/mechs/types.ts`
- `src/mechs/sections.ts`
- new `src/mechs/runtime/` or `src/mechs/contracts/` files
- `src/entities/GolemController.ts`

Definition of done:
- new mech helpers consume typed state instead of the whole `GolemController`
- section HP, steam, cooldowns, and mount state have shared typed shapes

## Phase 2: Pure Mech Rules Extraction
Extract pure mech logic from `GolemController`:
- section aggregation and destruction
- steam and overheat rules
- weapon cooldown and readiness
- mount availability from section damage
- loadout and mount legality checks

Target files:
- new `src/mechs/rules/sectionRules.ts`
- new `src/mechs/rules/steamRules.ts`
- new `src/mechs/rules/weaponRules.ts`
- `src/entities/GolemController.ts`

Definition of done:
- rules return plain objects or patches
- no `THREE`, `RAPIER`, or side effects in the extracted APIs
- old inline logic is removed once the new rules are in place

## Phase 3: Mech Runtime Split
Split mech runtime into narrow modules:
- `LocalMechMovementRuntime`
- `RemoteMechReplicationRuntime`
- `MechWeaponRuntime`
- `MechVisualDriver`
- `MechDamageRuntime`

Target files:
- new `src/mechs/runtime/LocalMechMovementRuntime.ts`
- new `src/mechs/runtime/RemoteMechReplicationRuntime.ts`
- new `src/mechs/runtime/MechWeaponRuntime.ts`
- new `src/mechs/runtime/MechVisualDriver.ts`
- new `src/mechs/runtime/MechDamageRuntime.ts`
- `src/entities/GolemController.ts`

`GolemController` should become a thin facade that wires these pieces together.

Definition of done:
- `GolemController` no longer directly owns both rules and presentation
- local and remote movement are no longer tangled with weapon rules
- visual sync and gameplay state mutation are clearly separated

## Phase 4: Engine Adapter Cleanup
Replace `create*Context(game)` style builders with explicit dependency objects.

Target files:
- `src/core/EngineRuntimeContexts.ts`
- `src/core/Engine.ts`

Definition of done:
- runtime builders no longer import `type Game`
- `Engine` passes narrow dependencies instead of exposing itself

## Phase 5: Presentation Cleanup
Move remaining desktop HUD and cockpit presentation out of `src/App.tsx` into `src/ui/combat/*`.

Target files:
- `src/App.tsx`
- new `src/ui/combat/*`

Definition of done:
- `App` acts as shell and state composition only
- combat widgets are presentational components with typed props

## Phase 6: Dead Layer Cleanup
Remove or replace transitional leftovers:
- `src/network/SyncManager.ts`
- `src/network/StateSerializer.ts`
- runtime modules that still create unnecessary `THREE.Vector3` DTOs in hot paths

Target files:
- `src/network/SyncManager.ts`
- `src/network/StateSerializer.ts`
- `src/core/match/MatchRuntime.ts`
- any remaining hot-path runtime modules

Definition of done:
- no duplicate "future networking layer" placeholders remain
- match/runtime DTO boundaries are explicit and consistent

## Validation Matrix
After every mech-facing runtime pass, manually verify:
1. local movement
2. remote movement and replication
3. weapon fire and recoil
4. steam and overheat behavior
5. section destruction and mount disable
6. respawn and section reset
7. hero visual sync
8. chassis and loadout swap

Structural passes must preserve all of the above before moving to the next phase.

## Test Fixture Strategy
Pure mech rule extraction should be backed by deterministic fixtures for:
- steam and overheat transitions
- section damage and HP aggregation
- weapon cooldown and readiness
- mount disable from damaged sections
- loadout and mount legality

These fixtures do not need full scene setup. They should operate on plain typed mech DTOs and make future refactors safer.

## Phase-by-Phase Validation
- Phase 1
  - contracts compile cleanly
  - no behavior change
- Phase 2
  - legality, steam, cooldown, section disable still match previous behavior
- Phase 3
  - movement, replication, recoil, and visual sync remain stable
- Phase 4
  - engine integration keeps update order intact
- Phase 5
  - UI behavior unchanged, only component placement changes
- Phase 6
  - no dead abstractions remain and no hot-path regressions are introduced

## Measurable Targets
- after Phase 2, `src/entities/GolemController.ts` should be below `650` lines
- after Phase 3, `src/entities/GolemController.ts` should be below `400` lines
- pure mech rule modules must have `0` imports from `THREE`, `RAPIER`, `AudioManager`, `DecalManager`, `MechCamera`, or `GolemController`
- after Phase 4, `src/core/EngineRuntimeContexts.ts` should no longer import `type Game`
- after Phase 5, desktop combat HUD logic should no longer live in `src/App.tsx`
- by the end of Phase 2, section, steam, and weapon readiness logic should each have a deterministic fixture or smoke-style rule test

## Recommended Next Step
Start with Phase 1 and Phase 2 on `src/entities/GolemController.ts`.

Highest-ROI extraction order:
1. section and HP aggregation
2. steam and overheat rules
3. weapon cooldown and readiness
4. mount availability from damaged sections

This is the lowest-risk path and creates the contracts needed for every later split.
