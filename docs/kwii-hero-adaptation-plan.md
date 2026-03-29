# KW-II Hero Mech Adaptation Plan

## Goal
Turn `mech-robot-kw-ii` into a web-ready hero mech for the local player while preserving silhouette and gameplay readability.

This is a hard-surface game-asset reduction pipeline, not a full character-retopology exercise.

## Source Asset Baseline
- Source: [mech_model.fbx](../mech-robot-kw-ii/source/model/mech_model.fbx)
- Current imported source:
  - ~`86.6k` triangles
  - `162` bones
  - `156` mesh objects
  - `3` materials
  - has animation data including a walk action

## Runtime Budgets
- Geometry target: `10k-12k triangles`
- Acceptable fallback: `15k triangles`
- Runtime skeleton target: `25-40` bones
- Vertex influences: `<= 4` per vertex
- Materials: `1`, acceptable fallback `2`
- Textures:
  - BaseColor `1024`
  - Normal `1024`
  - ORM packed `512-1024`
  - Emissive `512`
- Preferred `GLB`: `3-6 MB`

## Runtime Contract
The exported mech must contain stable nodes for the current gameplay code:
- `viewAnchor`
- `leftArmMount`
- `rightArmMount`
- `torsoMount`

The asset must also have a correct forward axis in Blender so runtime does not need another arbitrary `180°` offset fix.

## Candidate Runtime Bone Map
First-pass runtime candidates identified from the source rig:
- pelvis/root: `DEF-HIPS`
- torso base: `DEF-BODY`
- upper torso: `DEF-UPPER-BODY`
- head/camera cluster: `DEF-CAMERAS-BASE`
- left arm: `DEF-ARM.L`
- right arm: `DEF-ARM.R`
- left arm weapon: `DEF-CANON.L` or `DEF-MINIGUN.L`
- right arm weapon: `DEF-CANON.R` or `DEF-MINIGUN.R`
- left leg: `DEF-LEG.L`
- right leg: `DEF-LEG.R`

These are only first-pass mapping candidates. Final export bones still need cleanup and reduction.

## A/B Gate
KW-II should not replace the current hero mech until it is better than the current Marceline asset in:
- third-person readability
- camera framing
- weapon mount correctness
- torso twist readability
- runtime performance
- bundle impact

## Execution Phases

### Pass 0. Proxy Validation
Before reduction work:
- validate scale in game space
- validate general silhouette in third-person
- validate likely mount placement
- validate whether the mech is worth adapting at all

### Pass 1. Source Freeze and Blender Workspace
Keep source files untouched:
- [mech_model.blend](../mech-robot-kw-ii/source/model/mech_model.blend)
- [mech_model.fbx](../mech-robot-kw-ii/source/model/mech_model.fbx)

Use a separate working scene and collection layout:
- `KWII_WORK`
- `KWII_SOURCE`
- `KWII_HIGH`
- `KWII_LOW`
- `KWII_BAKE`
- `KWII_EXPORT`

### Pass 2. High Cleanup
Prepare source for baking:
- remove junk and hidden internals that do not affect exterior bake
- normalize transforms
- confirm actual facing
- isolate regions:
  - pelvis
  - torso
  - head
  - left arm
  - right arm
  - left leg
  - right leg
  - weapon housings

### Pass 3. Lowpoly Rebuild
Do not retopo the whole mech as one organic mesh.

Rebuild the lowpoly by rigid regions:
- torso + pelvis
- arms + weapon housings
- legs + feet
- head + hero details

Keep silhouette geometry.
Bake small and medium detail.

Internal target budget:
- torso + pelvis: `3k-3.5k`
- arms + housings: `2k-2.5k`
- legs + feet: `3k-3.5k`
- head + accents: `1k-1.5k`

### Pass 4. UV and Materials
- consolidate to `1-2` materials
- build one clean UV layout
- keep consistent texel density
- avoid fragmented texture sets

### Pass 5. Bake Detail
Bake from high to low:
- Normal
- AO
- optional support masks if useful

Bake by region if whole-mech bake produces artifacts:
- torso
- arms
- legs

### Pass 6. Runtime Skeleton
Reduce runtime bones to `25-40`.

Keep only bones needed for:
- pelvis/root
- torso
- head
- arms
- legs
- feet
- weapon pivots if required

Remove runtime export of:
- IK bones
- MCH bones
- rig controls
- helper wires and non-deforming internals

### Pass 7. Sockets
Add and verify:
- `viewAnchor`
- `leftArmMount`
- `rightArmMount`
- `torsoMount`

### Pass 8. Animation Scope
First pass only needs:
- `idle`
- `walk`
- optional simple damage/death clip if cheap

Do not try to bring the full source action set into the first export.

### Pass 9. Export and Web Compression
Export a `GLB` candidate and then optimize:
- reduce texture resolution
- remove unused actions
- remove orphan materials/data
- use geometry compression where practical

### Pass 10. Controlled Integration
Integrate KW-II only for the local player first.

Keep current Marceline mech as fallback.
Do not switch bots or remote players to KW-II in the first pass.

## Acceptance Criteria
- `10k-12k` triangles, or at most `15k` if silhouette requires it
- `<= 40` runtime bones
- `<= 4` weights per vertex
- `1-2` materials
- proper sockets exported
- correct forward axis
- local-player integration works cleanly
- third-person framing is better than the current hero mech
- runtime cost remains acceptable for the web build

## Current Status
Completed:
- source asset baseline measured
- Blender work collections created
- isolated source import prepared in `KWII_SOURCE`
- working scene saved as `mech-robot-kw-ii/kwii_gameprep.blend`
- provisional runtime helpers created in Blender:
  - `viewAnchor`
  - `leftArmMount`
  - `rightArmMount`
  - `torsoMount`
- blockout guide objects created for:
  - pelvis
  - torso
  - head
  - left/right arms
  - left/right legs
- first-pass lowpoly blockout created in `KWII_LOW`:
  - `KWII_Low_Pelvis`
  - `KWII_Low_Torso`
  - `KWII_Low_Arm_L`
  - `KWII_Low_Arm_R`
  - `KWII_Low_Leg_L`
  - `KWII_Low_Leg_R`
- `KWII_Low_Pelvis` and `KWII_Low_Torso` were then rebuilt into a first hard-surface hero shell with:
  - central waist mass
  - hip housings
  - front glacis / crotch guard
  - lower hull
  - upper chest mass
  - shoulder pods
  - backpack / rear torso mass
- `KWII_Low_Arm_L` and `KWII_Low_Arm_R` were then rebuilt into a first arm shell with:
  - shoulder block
  - upper arm hinge housing
  - elbow node
  - forearm / weapon mass
  - muzzle block
- `KWII_Low_Leg_L` and `KWII_Low_Leg_R` were then rebuilt into a first leg shell with:
  - thigh armor block
  - knee assembly
  - shin housing
  - rear calf mass
  - ankle block
  - foot wedge
- current lowpoly scaffold baseline: `528` triangles total
- current pelvis + torso shell budget: `192` triangles
- current arm + leg shell budget: `336` triangles
- updated Blender work scene saved with lowpoly scaffolding

Next:
- convert the current shell into a cleaner bake-ready lowpoly surface
- add selective hard-surface cuts only where they improve the gameplay silhouette
- prepare bake-friendly low/high overlap by region
