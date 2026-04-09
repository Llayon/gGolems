# Arena and Village Architecture Plan v3

> Status: Implementation plan
> Current relevance: Active target plan for arena/world-prop refactor. This version tightens the document into an implementation spec with map, runtime, and telemetry contracts.

## Goal
Rebuild arena content architecture around a cheaper static village layer, a smaller set of high-value breakable structures, and a clearer combat layout for mech fights.

This plan is intentionally hybrid. The project should not move to "everything baked in Blender" and should not move to "everything assembled from runtime modules". Both extremes create unnecessary costs.

## Current State Snapshot
As of the current codebase:

- [src/world/WorldPropSystem.ts](../src/world/WorldPropSystem.ts) already acts as the facade over static village, breakable structures, trees, and ambient props
- [src/world/StaticVillageManager.ts](../src/world/StaticVillageManager.ts) already loads authored village blueprint and manifest data, but still places prefab clones instead of true chunked instancing
- [src/world/BreakableStructureManager.ts](../src/world/BreakableStructureManager.ts) already owns coarse sectioned houses, but proximity-based proxy activation is not yet meaningfully enabled
- [src/world/Arena.ts](../src/world/Arena.ts) already expresses a lane-oriented `A / B / C` layout with themed `village`, `center`, and `steam` spaces
- [src/core/buildGameHudState.ts](../src/core/buildGameHudState.ts) and [src/ui/combat/MatchStatusOverlay.tsx](../src/ui/combat/MatchStatusOverlay.tsx) already provide a clearer `Control` summary than the original HUD
- [src/core/Engine.ts](../src/core/Engine.ts), [src/core/bots/BotRuntime.ts](../src/core/bots/BotRuntime.ts), and [src/entities/DummyBot.ts](../src/entities/DummyBot.ts) already contain role-aware bot objective targeting and basic intents

This means the next phase is no longer "invent the architecture". The next phase is to harden the current architecture into a deterministic, measurable world-and-map system.

## Key Corrections

### Arena Size
- The current arena is already larger than `200x200`.
- In [src/world/Arena.ts](../src/world/Arena.ts), `halfSize = 132`, which means the full playable world is `264x264`.
- A literal move to `200x200` would be a reduction, not an expansion.
- The recommended interpretation is:
  - keep the current world near its present bounds during the first refactor pass
  - define a `200x200` combat core inside that world
  - only expand the full world later if the relayout proves a larger ring is useful
- If the project later decides to make the full world larger, the correct target for a full `400x400` world is `halfSize = 200`.

### Asset Strategy
- Do not keep every house as a unique baked prop.
- Do not assemble every interactive structure from dozens of tiny runtime pieces.
- Use a hybrid structure:
  - static village chunks for most buildings
  - separate sectioned breakable houses for combat-relevant structures

## Core Decisions

### 1. Split Static and Breakable Structures
- `70-80%` of village geometry should be static.
- `15-25%` should be partially breakable.
- Only `2-4` structures per match should be fully combat-relevant breakable houses.

### 2. Keep Breakable Houses as Separate Actors
- Breakable houses should remain separate `GLB` assets with `8-12` coarse sections.
- Sections should be large gameplay parts, not tiny kit pieces.
- Suggested sections:
  - `foundation`
  - `front`
  - `back`
  - `left`
  - `right`
  - `roof`
  - `chimney`
  - `props`

### 3. Build Static Village from Modules
- Static village content should come from a reusable module library.
- Use one `village_modules.glb` with named meshes instead of many tiny standalone `GLB` files.
- Use blueprint data to place modules into buildings and buildings into village chunks.
- Render static village by chunked `InstancedMesh`, not by one global instance pool for the whole map.

### 4. Use Proxy-to-Live Swap
- Distant or inactive buildings should exist as static proxies only.
- When a player gets close enough, or when the structure first takes damage, a breakable proxy can be replaced with the full sectioned actor.
- This keeps the world cheap while preserving convincing destruction where it matters.

## Gameplay Role of Non-Breakable Buildings
Non-breakable buildings are only valid if their gameplay role is clear.

They should be used for:
- stable route blockers
- permanent cover anchors
- skyline landmarks
- visual framing of bases and objective lanes
- background density that does not need networked destruction state

They should not be used as arbitrary "fake" wooden houses that ignore damage without explanation.

## World Fiction Rules
To keep player expectations readable:
- stone, reinforced, or rune-bound structures are durable or non-breakable
- wood, plaster, balconies, roofs, fences, and light outbuildings are breakable
- decorative clutter is fully disposable

This gives players a readable rule:
- heavy fortified structures hold
- civilian timber structures degrade
- props and light clutter explode first

## Target Runtime Architecture

### WorldPropSystem
Single facade used by the arena and combat systems.

Responsibilities:
- initialize all world prop subsystems
- expose aggregate collision meshes
- route hit events to the correct subsystem
- own cross-system cleanup and reset

### StaticVillageManager
Responsible for low-cost non-interactive or lightly interactive settlement content.

Responsibilities:
- load `village_modules.glb` once
- read blueprint data
- build village chunks
- create chunked `InstancedMesh` groups
- manage simple coarse colliders per building or per chunk
- optionally handle proxy-to-live swaps

### BreakableStructureManager
Responsible for houses or structures that can take damage and lose major sections.

Responsibilities:
- load sectioned breakable templates
- clone breakable structures into the world
- own section HP, section state, and fall-off behavior
- own Rapier section colliders
- emit destruction FX events

### Breakable Damage Model
The project should borrow selected ideas from modular building destruction, but only at section scale.

Keep:
- explicit `hp`, `maxHp`, `damageState`, and `destroyed` state per breakable section
- staged visuals such as `intact`, `damaged`, `critical`, and `destroyed`
- fake-physics debris instead of live rigidbody simulation for every fragment
- capped mobile-aware budgets for debris, decals, sparks, and collapse depth
- cascade collapse behavior as a gameplay rule

Change:
- damage should target authored sections, not every tiny render module
- structural integrity should use authored support metadata, not naive grid-neighbor checks
- the default path should prefer material swaps, decals, and pre-broken variants over arbitrary runtime vertex deformation
- hit processing should operate on a maintained set of shootable section objects or broadphase data, not rebuild a mesh list per shot

Do not use:
- per-piece `geometry.clone()` and `material.clone()` as the baseline state for every structure element
- random per-client deformation without deterministic seeds or authored state
- stringly-typed effect replication as the only network contract
- random runtime ids for synchronized world structures

### Breakable Section Authoring Contract
Each breakable structure section should carry stable authored metadata.

Required metadata:
- `sectionId`
- `sectionType`
- `maxHp`
- `destructible`
- `supportGroup`
- `supportedBy`
- `collapseGroup`

Behavior rules:
- `foundation` sections are usually non-destructible or collapse-immune
- `wall`, `roof`, `chimney`, and `prop` sections may collapse depending on support state
- collapse checks should be limited and deterministic
- any client that receives the same section state should render the same gameplay result

Authoring ownership:
- artists should author section metadata in Blender custom properties or an equivalent structure authoring source of truth
- export tooling should validate and emit this metadata into `glTF extras` or a companion manifest
- runtime should consume authored support data and must not infer the authoritative support graph from raw geometry

### Breakable FX Rules
Breakable structure feedback should stay visually strong but runtime-cheap.

Use:
- pooled debris objects
- pooled impact sparks
- a capped number of decals per structure
- terrain-aware debris settling

Avoid:
- unbounded debris creation
- allocating new materials and geometries per hit when pooling or reuse would work
- relying on render-mesh fidelity for gameplay readability

### Breakable Network Contract
Destruction state must be host-authoritative.

Rules:
- the host computes final damage, state transitions, and cascade destruction
- clients may show speculative hit FX, but must converge to host section state
- world structures must come from deterministic authored manifests
- numeric wire indices are allowed for bandwidth efficiency only when they resolve against a versioned deterministic structure table

Canonical runtime concepts:
- `layoutVersion`: identifies the authored structure and chunk ordering shared by all peers
- `structureIndex`: stable numeric index inside the deterministic structure table
- `sectionIndex`: stable numeric index inside a structure's authored section table
- `tick`: host ordering value used to reject stale updates

Suggested wire shape:

```ts
enum SectionState {
  INTACT = 0,
  DAMAGED = 1,
  CRITICAL = 2,
  DESTROYED = 3,
}

interface SectionDamageEvent {
  type: 'section_damage';
  layoutVersion: number;
  structureIndex: number;
  sectionIndex: number;
  hp: number;
  state: SectionState;
  cascadeDestroyed?: number[];
  tick: number;
}
```

Implementation rules:
- authored string ids remain the source-of-truth in content and tooling
- runtime may map those ids to numeric indices for transport
- structure order must never depend on random runtime ids
- applying the same ordered event stream must produce the same final section state on every peer

### TreeManager
Responsible only for trees and their destruction state.

### AmbientPropManager
Responsible for carts, crates, fences, civilians, and low-cost decor that should not live inside the same class as houses.

Responsibilities:
- own low-cost decorative props and clutter
- keep these props out of breakable-house and tree-specific logic
- support simple hit reactions only when they do not require persistent authoritative state
- avoid long-lived networked destruction state unless a prop is promoted into a dedicated gameplay system

## Asset Pipeline

### Static Village Pipeline
Use:
- `village_modules.glb`
- `village_blueprints.json`
- one shared village atlas
- compressed textures in `KTX2/Basis`
- compressed geometry with `Meshopt` or `Draco`

Rules:
- prefer one atlas across the village set
- avoid duplicated textures per module file
- start with one `village_modules.glb` core pack
- if the compressed core pack exceeds first-load targets or becomes too large for blocking load, split it into `2-3` zone packs only after profiling
- prefer `KTX2/Basis` textures, with `WebP` fallback where target WebViews require it
- avoid one-file-per-module packaging unless it is proven better in measured builds

### Breakable Structure Pipeline
Use separate `GLB` files for breakable buildings.

Rules:
- keep sections named and stable
- export explicit metadata for section ids and section types
- keep collision authored as simple logical parts, not render mesh fidelity

### Static Village Blueprint Schema
Static village layout data should be compact, deterministic, and versioned.

Suggested schema:

```json
{
  "schemaVersion": 1,
  "assetPackVersion": "village_core_v1",
  "chunks": [
    {
      "id": "village_block_west",
      "moduleNames": [
        "Wall_Straight",
        "Wall_Window",
        "Wall_Door",
        "Corner_Brick",
        "Roof_Straight"
      ],
      "buildings": [
        {
          "id": "west_house_00",
          "kind": "house_small",
          "modules": [
            [0, 0, 0, 0, 0],
            [0, 2, 0, 0, 0],
            [1, 0, 0, 0, 1],
            [3, 0, 0, 0, 0],
            [4, 0, 3, 0, 0]
          ],
          "collider": {
            "type": "box",
            "size": [6, 6, 6],
            "offset": [3, 3, 3]
          },
          "proxyBreakableType": "house_breakable_a"
        }
      ]
    }
  ]
}
```

Schema rules:
- `moduleNames` is the lookup table for compact module references inside a chunk
- each module placement is `[moduleNameIndex, x, y, z, rotationSteps]`
- `rotationSteps` is quarter-turn encoded as `0`, `1`, `2`, or `3`
- coordinates should use deterministic authored local units and remain snap-friendly
- chunk order and building order must be deterministic and versioned
- static collision data should be authored alongside the building, not reconstructed from every visual module at runtime

## Loading and Progression Strategy

Blocking load target:
- `<= 3s` on a representative mobile `4G` connection for shell, current player mech, terrain, and the static village core pack

Suggested loading sequence:
1. UI shell and Telegram-specific bootstrapping, then show splash
2. core JS bundle and minimal loading UI
3. current player mech and its required runtime assets
4. arena terrain and static village core pack
5. breakable structure templates in parallel
6. remote mech content when a peer session is established
7. audio and non-critical ambience after first input, not as a blocking dependency

Rules:
- the player should see a coherent arena shell before non-critical assets finish
- static proxies may appear before breakable templates are fully ready
- loading UI must surface progress for long-running asset phases

## Collision Strategy

### Static Village
- do not create a collider per module piece
- use `1-4` simple colliders per building or block
- prefer one `cuboid` per building footprint unless the shape clearly needs more
- collider height should cover the movement-blocking bulk of the structure
- no interior collision for static buildings unless the building is intended to be enterable
- static village colliders should live in a dedicated Rapier group such as `STATIC_ENVIRONMENT`
- prioritize predictable movement over exact projectile silhouette detail

### Breakable Structures
- keep simple `cuboid` or `cylinder` colliders per large section
- do not derive live collision from arbitrary render geometry unless profiling proves it necessary
- use one movement-blocking collider per large wall or support section
- remove or disable a section collider when that section is destroyed
- breakable colliders should live in a dedicated Rapier group such as `BREAKABLE_STRUCTURE`

### Projectile and Movement Rules
- mech movement collides with `STATIC_ENVIRONMENT` and `BREAKABLE_STRUCTURE`
- projectile hit tests should query maintained shootable breakable sections or equivalent broadphase data
- static village modules do not individually participate in projectile hit tests unless explicitly promoted for gameplay
- debris is visual only and should not create long-lived collision

## Arena Layout Plan
The arena should be redesigned by zone role, not by scattering props.

### Combat Core
- target an effective combat area around `200x200`
- this is the space where objectives, major cover, and breakable houses matter

### Background Ring
- use the outer ring for skyline, static quarters, fortified walls, and large landmarks
- keep this area visually rich but gameplay-light

### Primary Zones
- `West Base`
  - heavily fortified
  - stable cover
  - mostly non-breakable
- `Central Square`
  - main conflict area
  - mixed low cover and open lines
  - one or two partial breakables
- `Village Lane`
  - clustered houses
  - main place for breakable civilian architecture
  - flank-oriented pathing
- `Ruin or Steam Lane`
  - industrial or ruin-heavy route
  - mostly static heavy shapes
  - alternate cover rhythm to the village side

### Objective Roles
- `A`: village-side control point
- `B`: central square anchor point
- `C`: ruins or steam-side control point

This creates a readable rhythm:
- village flank
- central brawl
- heavy-industrial flank

## Combat Topology Contract
Every lane and every objective space must satisfy a consistent combat topology.

### Lane Contract
Each primary lane must provide:
- one primary route that is the fastest obvious way to contest the lane
- one safer fallback route that trades speed for survivability
- at least one retake entry that allows pressure after losing the lane anchor
- one hold pocket that supports temporary defense without being permanently dominant
- one punishable overextension zone that rewards disciplined crossfire

### Objective Space Contract
Each control point space must provide:
- one obvious capture footprint
- one readable contest edge
- at least two approach vectors
- nearby cover that supports contesting without turning the point into a bunker
- at least one punish angle for teams that overcommit to the point center

### Topology Review Rule
Do not consider a lane "finished" because it looks themed. A lane is only done when:
- its route choices are readable in motion
- its hold pocket is useful but breakable by rotation or destruction
- a losing team still has a viable retake entry

## Spawn Safety Contract
Spawn logic must actively protect match pacing and prevent silent snowball failures.

### Spawn Rules
- never spawn a player if an enemy is within the unsafe proximity radius for that spawn cluster
- never spawn a player into direct line-of-sight of a dominant objective angle when an alternate spawn is available
- prefer spawn candidates that restore pressure on the team's weakest lane instead of stacking the same route every time
- respawn-to-re-engage distance must remain bounded and measured, not guessed

### Spawn Safety Evaluation
Each spawn candidate should be scored by:
- enemy proximity
- enemy line-of-sight danger
- recent death density near the spawn
- route length to the nearest useful objective
- team spread, so that the game does not create isolated trickle spawns

### Anti-Snowball Rule
If one team loses a point, the next spawn wave must still have:
- one safe route back into the match
- one realistic retake option
- enough cover to re-enter combat without immediate deletion

## Bot Navigation Contract
Bots should graduate from "drive to a target position" into lane-aware authored navigation.

### Required Node Types
- `lane_anchor`
- `hold_node`
- `rotate_node`
- `retreat_node`
- `staging_node`
- `objective_entry`

### Bot Routing Rules
- `anchor` bots prefer `hold_node` and nearby `objective_entry` routes
- `assault` bots prefer the fastest pressure route unless health or heat state forces retreat
- `flank` bots prefer off-angle `rotate_node` routes and punish exposed hold pockets
- `retreat` state must resolve to authored safe nodes, not arbitrary reverse movement
- bots should never treat the map as pure open-space steering when authored nodes exist

### Navigation Definition Of Done
The navigation layer is only good enough when:
- bots distribute across entries instead of stacking one point center
- retreats create recovery behavior rather than random drift
- rotations follow understandable lane logic

## Destruction Value Rules
Breakables exist to change combat space, not just to add spectacle.

Keep a structure breakable only if its destruction changes at least one of:
- a sightline
- a cover shape
- a route timing window
- a retake entry

Do not keep a structure breakable if it only:
- creates particles
- removes set dressing
- makes the lane noisier without changing decisions

### Breakable Placement Rule
Each breakable structure should be tagged in design review as one of:
- `angle opener`
- `cover breaker`
- `route opener`
- `hold dislodger`

If it fits none of those tags, demote it to static content.

## Performance Budgets
These numbers should be treated as design constraints, not rough wishes.

### Static Village
- most buildings rendered through chunked instancing
- no per-piece rigidbody state
- minimal blueprint payload
- village core blueprint payload target: `<= 20 KB` compressed
- visible static village draw-call target on mobile-quality settings: `<= 16` from the village system itself
- visible static village chunk count target: `<= 4` at once before optional higher-quality settings

### Breakable Structures
- only a small number active per match
- only large sections synchronized
- no tiny gameplay sections
- active breakable structures target: `<= 4`
- authored sections per structure target: `<= 12`
- active network-synchronized breakable sections target: `<= 48`
- decals per breakable structure target: `<= 5` mobile, `<= 20` desktop
- total live debris target: `<= 30` mobile, `<= 100` desktop

### Loading
- one static village module pack
- a small breakable set loaded separately
- texture compression mandatory for mobile web targets
- static village core pack target: keep blocking-load contribution within the `<= 3s` first-load target
- if measured first-load cost is too high, split the village module pack by zone rather than by individual module

## Telemetry Minimum Set
The architecture and layout plan is not complete without runtime measurement.

Track at minimum:
- `time_to_first_engagement`
- `respawn_to_reengage`
- `lane_occupancy`
- `point_contest_duration`
- `breakable_trigger_count`
- `spawn_death_window`
- `point_flip_frequency`
- `bot_objective_uptime`

Interpretation rules:
- if one lane owns a disproportionate amount of occupancy, fix topology before adding content
- if `spawn_death_window` spikes, fix spawn safety before tuning damage
- if breakables trigger often but do not correlate with point flips or retakes, they are visual noise
- if bot objective uptime is low, fix navigation and intent routing before adding more bot combat polish

## Testing Strategy
Destruction and village systems should ship with explicit debug and determinism tools.

Required test support:
- debug action to cycle a section through `INTACT`, `DAMAGED`, `CRITICAL`, and `DESTROYED`
- debug action to destroy a random section and evaluate cascade behavior
- debug rendering for colliders, support groups, and collapse groups
- deterministic replay test: the same ordered hit sequence must produce the same final structure state
- network convergence test under simulated latency such as `200ms`
- mobile profile run with debris, decals, and breakable caps enforced
- repeated map-topology test: verify each lane still has a retake route and hold pocket after destruction
- spawn safety test: repeatedly kill and respawn units near all three objectives and verify the game avoids direct death funnels

## Migration Plan

### Phase 0: Budgets and Measurement
- define asset size targets
- define draw call targets
- define acceptable destruction state counts
- profile current house asset load and render cost before replacing it
- capture the minimum telemetry set for `5-10` baseline matches

### Phase 1: Split the Current PropManager
Starting point:
- [src/world/PropManager.ts](../src/world/PropManager.ts)

Actions:
- extract current house destruction into `BreakableStructureManager`
- move trees into `TreeManager`
- leave existing behavior unchanged during the split
- add `WorldPropSystem` as the facade consumed by [src/world/Arena.ts](../src/world/Arena.ts)

Definition of done:
- `Arena` no longer depends directly on one monolithic prop class
- current gameplay still behaves the same

### Phase 2: Add StaticVillageManager
Actions:
- create `StaticVillageManager`
- load one `village_modules.glb`
- ingest a small blueprint set
- instantiate a first static village chunk
- use simple colliders only
- allow rough greybox layout iteration during this phase, but do not treat it as the final relayout pass

Definition of done:
- at least one block of houses renders through chunk-ready authored content
- no breakable gameplay is attached to that block yet

### Phase 3: Replace Background Houses
Actions:
- replace current decorative house cluster placements with static village chunks
- keep only combat-relevant houses as breakable actors

Definition of done:
- decorative houses no longer consume breakable-house runtime complexity

### Phase 4: Add Proxy-to-Live Swap
Actions:
- create static proxy versions for breakable house footprints
- swap to breakable actors on proximity or first damage

Definition of done:
- the system supports cheap distant presentation and full local destruction
- promotion radius and promotion triggers are measured and non-zero in gameplay builds

### Phase 5: Arena Relayout
Actions:
- reorganize the arena by zone role
- move objectives into `village / center / ruins`
- tune route spacing and cover density around the combat core
- validate each lane against the combat topology contract
- validate spawns against the spawn safety contract

Definition of done:
- the map reads as intentional lanes and landmarks instead of a spread of isolated prop islands
- each lane has a primary route, fallback route, retake entry, hold pocket, and punishable overextension zone

### Phase 5A: Bot Navigation Authoring
Actions:
- add authored lane and retreat nodes
- migrate objective bots from free-vector routing to node-guided routing
- validate `anchor`, `assault`, and `flank` behavior against authored navigation data

Definition of done:
- bots rotate through authored map logic rather than only chasing generic target positions
- retreats and re-entries are readable in replays and playtests

### Phase 6: Decide on World Expansion
Actions:
- only after the relayout, decide whether the current `264x264` world is enough
- if the project needs more background ring or route length, increase `halfSize`

Definition of done:
- arena size changes are justified by tested layout needs, not by guesswork

## Anti-Patterns
Avoid:
- one global `InstancedMesh` pool for the entire map
- one tiny `GLB` per module with duplicated textures
- making every civilian structure fully destructible
- making arbitrary wooden buildings indestructible without visual explanation
- leaving houses, trees, people, clutter, and destruction in one giant manager
- increasing world bounds before the combat layout is proven
- per-shot rebuilds of large raycast target arrays
- baseline per-piece geometry and material cloning for destruction
- random runtime ids for world props that need network sync
- naive grid-neighbor collapse logic as the authoritative structural model
- spawn rules that only use fixed points and ignore enemy proximity or line-of-sight
- bot routing that treats the arena as open steering space after lane roles have already been authored
- keeping breakables that do not change any route, angle, or cover decision

## Definition of Success
The plan is successful when:
- the map has a readable combat core and recognizable zone roles
- village background density becomes cheaper than the current house approach
- breakable structures remain meaningful and limited
- non-breakable structures feel justified in-world
- prop systems are split by responsibility instead of growing a larger `PropManager`
- future content can add village variants without rewriting core runtime code
- spawn safety and respawn pacing are enforced by explicit rules instead of ad-hoc placement
- bots navigate the map through authored lane logic, not only raw distance heuristics
- map tuning decisions are supported by telemetry rather than only by feel
