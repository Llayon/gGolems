# Gameplay Vertical Slice Roadmap v2

> Status: Active roadmap  
> Current relevance: Near-term gameplay execution plan for the next 1-2 weeks. This version adds phase gates, measurable targets, and explicit playtest rules.

## Goal
Ship one mode that feels good enough to replay without needing extra content, progression, or art polish to carry it.

The vertical slice target is:

- one map
- one primary mode
- one stable combat loop
- bots that understand the objective
- destruction that changes positioning instead of only looking flashy

## Primary Focus
Use `Control` as the main mode and treat `TDM` as secondary until the core loop is stronger.

Reason:

- the arena already has `A/B/C` structure
- lane identity matters more in `Control`
- destruction and cover matter more when players must take and hold space
- `Control` exposes more of the game's strengths than pure deathmatch

## Definition Of Success
At the end of this slice, all of the following should be true:

- the first `Control` match is readable from HUD and map flow alone
- players can explain the role of each tuned weapon in one sentence
- bots spend most of their time doing objective-relevant work
- `village`, `center`, and `steam/ruins` lanes feel meaningfully different
- destroying a key structure changes one real route, sightline, or hold position
- a full match produces rotation and retake decisions, not only random skirmishes
- at least one more match feels immediately desirable after the previous one ends

## Non-Goals
This slice does **not** include:

- a second main map
- broad visual polish or texture compression passes
- large mech roster expansion
- progression, unlocks, economy, or long-term retention systems
- deep networking redesign
- broad optimization work unless it blocks moment-to-moment feel

## Hard Scope Rule
Do not split effort evenly across systems. Work in this order:

1. mode readability
2. weapon feel and TTK
3. bot objective behavior
4. destruction as tactical cover
5. lane and spawn pacing
6. repeat playtest tuning

If a task does not improve one of those six items, it probably belongs after the slice.

## Baseline Pass
Before changing behavior, capture a rough baseline from `5-10` short matches.

Record:

- match length
- time to first meaningful engagement
- time from respawn to re-engage
- which point is taken first most often
- which lane becomes dominant
- whether one weapon feels mandatory
- whether bots spend time on points or drift into dead fights
- whether any destruction event actually changes a fight

This baseline can be manual. The point is to avoid "feels better" without evidence.

## Metrics
Use these as slice targets:

- first meaningful engagement: `12-18s`
- respawn-to-re-engage: `<= 20s`
- average match length: `4-7 min`
- dominant lane share: no single lane should decide `> 60%` of pushes over a test set
- active weapon archetypes under tuning: `3`
- objective-relevant bot time: `>= 60%`
- meaningful breakable structures on map: `2-4`
- tactical destruction events per match: at least `1-2`

These are not final ship metrics. They are vertical-slice control numbers.

## Phase Gates
Do not move forward unless the previous gate is good enough.

### Gate 0. Baseline captured
Definition of done:

- baseline notes exist for at least `5` matches
- top `3` current gameplay complaints are written down

### Gate 1. `Control` readability
Definition of done:

- players can answer "who owns what" and "why are we winning" from HUD alone
- contested and capture states are visible without standing on the point
- `Control` no longer feels like `TDM` with letters layered on top

### Gate 2. Weapon roles and TTK
Definition of done:

- three weapon archetypes are clearly differentiated
- no single weapon feels mandatory
- overheating and cooldown timing create punish windows

### Gate 3. Objective bots
Definition of done:

- bots hold, contest, rotate, and retreat in ways that support the mode
- bots no longer over-prioritize empty fights away from points

### Gate 4. Tactical destruction
Definition of done:

- only a few breakables remain
- those breakables affect a real lane decision
- the map still preserves stable landmarks and strong readable geometry

### Gate 5. Lane and spawn pacing
Definition of done:

- first engagements happen quickly
- lane identity is readable
- losing one point does not create an unrecoverable spawn spiral

## Workstreams

### 1. Make `Control` the clear primary mode
Touch points:

- [MatchRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/match/MatchRuntime.ts)
- [ControlPointManager.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/gameplay/ControlPointManager.ts)
- [buildGameHudState.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/buildGameHudState.ts)
- [gameHudState.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/gameHudState.ts)

Tasks:

- tighten point state messaging: neutral, capturing, contested, held
- make score swings and ownership transitions easier to read
- ensure `A/B/C` labeling matches lane expectations
- expose enough state for players to understand where pressure is building

### 2. Tune weapon feel before adding more weapons
Touch points:

- [weaponRules.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/mechs/rules/weaponRules.ts)
- [steamRules.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/mechs/rules/steamRules.ts)
- [ProjectileCombatRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/combat/ProjectileCombatRuntime.ts)
- [ProjectileCombatFxRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/combat/ProjectileCombatFxRuntime.ts)
- [PlayerHitRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/combat/PlayerHitRuntime.ts)

Required archetypes:

- sustained pressure
- burst punish
- utility or finisher

For each archetype, define:

- ideal range
- tactical role
- counterplay
- heat profile
- punish window

Tasks:

- tune `TTK` so peek, disengage, and recommit all matter
- improve hit confirmation and impact readability
- remove overlapping behavior where two weapons solve the same problem too similarly

### 3. Make bots play the objective
Touch points:

- [BotRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/bots/BotRuntime.ts)
- [RespawnRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/respawn/RespawnRuntime.ts)
- [MatchRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/match/MatchRuntime.ts)

Required bot intents:

- `hold`
- `contest`
- `rotate`
- `retreat`
- `chase`

Tasks:

- make `hold`, `contest`, `rotate`, and `retreat` the objective-safe defaults
- reduce pointless `chase` behavior away from the mode objective
- add low-HP / high-heat retreat logic
- make respawning bots rejoin useful pressure instead of scattering

### 4. Use destruction as a tactical mechanic
Touch points:

- [BreakableStructureManager.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/world/BreakableStructureManager.ts)
- [Arena.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/world/Arena.ts)
- [propShared.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/world/propShared.ts)

Tasks:

- keep only the `2-4` most meaningful breakable structures
- place them so destruction opens an angle, route, or retake option
- preserve non-breakable landmarks so the map stays readable
- make the feedback strong enough to signal "this lane just changed"

### 5. Finish lane and spawn pacing
Touch points:

- [Arena.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/world/Arena.ts)
- [RespawnRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/respawn/RespawnRuntime.ts)
- [MatchRuntime.ts](/D:/Programms/Max/GODOT/Golem/gGolems/src/core/match/MatchRuntime.ts)

Target lane roles:

- `village lane` = flank-heavy route with partial cover and tactical destruction
- `center` = fast rotation lane with higher risk and lower hold security
- `steam/ruins lane` = heavier cover and anchor-friendly pressure

Tasks:

- reduce useless runback time after respawn
- avoid spawn traps while preserving control-point pressure
- make the correct reason to rotate be map state, not confusion

## Suggested 10-Day Slice

### Days 1-2
- capture baseline
- lock `Control` readability and scoring clarity
- remove ambiguous point-state behavior

### Days 3-4
- tune the three weapon roles
- adjust TTK and heat pacing
- do not add new weapons during this window

### Days 5-6
- rework bot intent around points
- verify both offline and host sessions show objective-focused behavior

### Days 7-8
- tune the most important breakable structures
- remove low-value breakables that only add noise

### Days 9-10
- tune spawn timing and lane pressure
- run repeated matches and log the top `3` complaints after each pass

## Playtest Scenarios
Run all three:

### Scenario A. Solo with bots
Use this to test:

- lane readability
- weapon role clarity
- objective messaging
- bot intent quality

### Scenario B. Host plus one real player
Use this to test:

- whether match flow survives against less predictable human movement
- whether point control and rotations stay readable under live pressure

### Scenario C. Stress pass
Use this to test:

- repeated fights around `A/B/C`
- respawn pacing
- whether destruction creates chaos or useful decisions

## Playtest Checklist
After each pass, answer:

1. Was the winning condition obvious?
2. Did one lane become the only correct lane?
3. Did one weapon dominate without clear counterplay?
4. Did bots support the mode or cheapen it?
5. Did destruction create a tactical decision?
6. Would you queue another match immediately?

If item `6` is "no", do not expand scope.

## Rollback Rule
Revert or simplify changes if they:

- make HUD state less readable
- make one lane clearly dominant
- increase match length without adding better decisions
- cause bots to leave objective play more often
- add destruction noise without changing map tactics

Do not preserve a change just because it was expensive to build.

## Stop Doing
During this slice, avoid:

- polishing assets instead of fixing lane function
- adding content while `Control` is still muddy
- keeping decorative breakables that confuse target priority
- compensating for weak combat with larger maps or bigger numbers
- letting bots bypass objective play just because they shoot well

## After This Slice
Only after this slice is stable should the next branch open:

1. asset compression and budget cleanup
2. second map or map variant
3. stronger mech differentiation
4. progression or persistence hooks

If the slice fails, do not expand scope. Cut weaker systems until one mode becomes fun.
