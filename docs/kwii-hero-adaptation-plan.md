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
- the shell was then cleaned into a more bake-ready outer hull pass:
  - overlapping block masses replaced with cleaner outer-shell meshes
  - `non-manifold` edges reduced to `0` on all current lowpoly body parts
  - multiple mesh islands still remain by design where separate hard-surface shell panels are acceptable
- selective hard-surface cuts were then added only where they materially improve gameplay silhouette:
  - torso chest / shoulder chamfers
  - pelvis front armor break
  - arm shoulder and muzzle chamfers
  - leg knee and toe bevels
- regional bake-prep collections were created in `KWII_BAKE`:
  - `KWII_BAKE_TORSOPELVIS_LOW`
  - `KWII_BAKE_ARMS_LOW`
  - `KWII_BAKE_LEGS_LOW`
  - `KWII_BAKE_TORSOPELVIS_HIGH`
  - `KWII_BAKE_ARMS_HIGH`
  - `KWII_BAKE_LEGS_HIGH`
- source high meshes are now roughly split by bbox-center proximity:
  - torso/pelvis high: `78`
  - arms high: `29`
  - legs high: `49`
- the bake structure was then tightened further:
  - low and high bake objects now carry `kwii_bake_region` / `kwii_bake_role` props
  - region anchors were added:
    - `KWII_BAKE_TORSOPELVIS_ANCHOR`
  - `KWII_BAKE_ARMS_ANCHOR`
  - `KWII_BAKE_LEGS_ANCHOR`
  - ambiguous high parts are now isolated in `KWII_BAKE_REVIEW_HIGH`
  - current ambiguous high count: `17`
- the previous intermediate low shell then proved structurally unreliable for silhouette review because of broken object/mesh transform offsets
- instead of forcing bake prep on a bad shell, `KWII_LOW` was rebuilt cleanly from the larger `KWII_Blockout_*` guide meshes:
  - `KWII_Low_Pelvis`
  - `KWII_Low_Torso`
  - `KWII_Low_Head`
  - `KWII_Low_Arm_L`
  - `KWII_Low_Arm_R`
  - `KWII_Low_Leg_L`
  - `KWII_Low_Leg_R`
- this reset the low shell to a much cleaner hero-silhouette stage with:
  - coherent body mass
  - readable arm spacing
  - readable leg stance
  - stable transforms for preview and future cleanup
- updated Blender work scene saved with lowpoly scaffolding
- the preview pipeline was then repaired so silhouette checks are reliable again:
  - the source mech in `KWII_SOURCE` was forced visible again for render checks
  - preview camera clipping and framing were fixed
  - fresh `kwii_source_*` and `kwii_low_*` preview renders now come from the actual working scene
- once the rebuilt clean shell was visible again, it became clear that it had drifted too far from the original KW-II character:
  - too generic
  - too blocky
  - too little of the original shoulder / tank / leg rhythm remained
- bake work was therefore paused on purpose and replaced with a source-faithful silhouette pass
- the current `KWII_LOW` has now been pushed back toward the source silhouette with:
  - a narrowed tapered torso instead of a pure box chest
  - a smaller pelvis connector so the legs read separately again
  - visible spaced legs and feet instead of the lower body collapsing into one block
  - stronger shoulder towers
  - stronger side tanks
  - clearer forward gun read
- the latest low shell is still intentionally simple, but it is now a coherent hero-mech blockout again rather than a broken scaffold
- a follow-up `profile rhythm` pass then pushed the low shell closer to the original KW-II massing:
  - guns moved further forward
  - side tanks pushed lower and further back
  - backpack and top shell enlarged to restore the heavier rear profile
  - leg stance widened
  - feet lengthened and widened so the mech reads as supported rather than perched on posts
- a further `heavy-rhythm` pass then reinforced the source look:
  - shoulder towers were made taller and heavier
  - side tanks were enlarged into more obvious suspended masses
  - legs were reshaped to read more like thigh-to-shin segments instead of uniform columns
  - the front silhouette is now much closer to the original `KW-II` rhythm even though it is still intentionally low-detail
- a dedicated `leg + profile` pass then corrected two of the biggest remaining mismatches against the source:
  - the lower body was strengthened with wider feet, clearer shin/knee breakup, and a more load-bearing stance
  - the side silhouette was deepened with a larger backpack, a heavier upper rear mass, and more pronounced suspended tank volume
  - the arms and guns were moved into a stronger forward/rear relationship so the mech no longer reads as a flat front-only block
  - the current shell is still only a blockout, but it now carries a much more credible `KW-II` front-to-back rhythm
- a contour-focused pass then started replacing pure block scaling with more source-faithful shape logic:
  - the torso now has clearer chest/waist breakup instead of reading as a single clean wedge
  - the pelvis was tightened into a stronger lower guard / connector shape
  - the arm blocks were reshaped to read more like shoulder-root + gun-housing volumes
  - the side tanks were reshaped from simple capsules into heavier suspended masses with a better rear/underside read
  - the feet and toes were given clearer heel/toe contour so the mech feels less like it is standing on flat slabs
- this is still not a final lowpoly, but it is the first pass where the shell starts carrying some of the original mech's contour language rather than only its proportions
- the leg work then hit the limit of what a single straight `KWII_Low_Leg_*` block could do
- instead of continuing to over-deform one column, the lower body was moved toward a more correct structural blockout:
  - each leg now reads as separate thigh and shin masses rather than one uninterrupted pillar
  - the reverse knee was pulled out as a clearer rearward joint block
  - the ankle and forefoot were repositioned as a forward support chain
  - this makes the mech read more like a bird-legged walker in `front` and `iso`, even though the side silhouette still needs more polish
- from this point on, further leg refinement should prefer contour polish over more extreme global scaling
- after that, a structural `hip connection` fix addressed the main construction error in the lower body:
  - the pelvis was widened slightly
  - explicit `hip socket` blocks were added
  - the upper thighs were pulled back inward under the torso instead of hanging laterally detached
  - the old visual gap between pelvis and thighs was removed, so the mech now reads as a single body supported by legs rather than a torso floating over separate leg blocks
- this did not finish the bird-leg problem in profile, but it fixed the more serious issue: the legs now actually attach to the torso mass
- current low preview state is being judged from:
  - `docs/blender_exports/kwii_previews/kwii_low_front.png`
  - `docs/blender_exports/kwii_previews/kwii_low_side.png`
  - `docs/blender_exports/kwii_previews/kwii_low_iso.png`
- after comparing the low shell directly against source side-view screenshots, it became clear that neutral silhouette alone was not enough:
  - the source side reference was showing a walk phase, not a neutral stance
  - the perceived mismatch was therefore partly leg shape and partly gait projection
- a separate `KWII_STRIDE_TEST` collection was created to evaluate stride silhouette without destabilizing `KWII_LOW`
- the lower body then received a stronger bird-leg pass:
  - hip sockets were enlarged slightly so the leg chain starts from a more credible support point
  - the thigh mass was shortened and tilted so it reads as an upper leg instead of a vertical post
  - the knee was tightened into a clearer pivot block
  - the shin was pushed into a longer diagonal support shape
  - the ankle and footplate were stretched into a more load-bearing digitigrade base
  - the toe was extended forward so the foot reads less like a flat slab
- after the neutral leg chain was updated, `KWII_STRIDE_TEST` was rebuilt from the refreshed base shell and re-posed with the visible left leg forward
- this does not finish the leg work, but it moves the lower body from "attached but column-like" to a more credible bird-leg structure in both neutral and stride checks
- the next leg pass focused specifically on side contour rather than whole-chain repositioning:
  - the hip socket was deepened so the thigh reads as rooted in a real side plate
  - the thigh was reshaped into a broader slanted armor plate instead of a short vertical block
  - the knee was tightened into a narrower pivot-like link
  - the shin was lengthened and angled more aggressively to reinforce the reverse-joint read
  - the footplate was lengthened and flattened into a more load-bearing base
  - a small rear heel support block was added so the foot no longer reads as only a toe slab
- `KWII_STRIDE_TEST` was then refreshed again from the new neutral shell so the stride check keeps matching the latest leg geometry
- this still is not final source fidelity, but the lower body is now much closer to a real mech bird-leg than to a broken post-and-slab chain
- one more leg-specific contour pass then moved the lower body closer to the source `KW-II` language:
  - a dedicated `thigh plate` block was added so the upper leg can read as armor-over-structure instead of as a single simple prism
  - the upper leg mass itself was slimmed and pushed into a steeper angle
  - the knee was reduced again into a narrower pivot-like link
  - the shin was lengthened and leaned further into the reverse-joint profile
  - the foot base was stretched slightly further while keeping the heel support
- `KWII_STRIDE_TEST` was refreshed from this new neutral state so the stride pose now includes the thigh-plate silhouette as well
- the result is still intentionally blocky, but the leg now starts to carry one of the key source cues: a front-loaded armored thigh over a leaner reverse-jointed support chain
- a deeper mechanical leg pass then pushed the lower body further away from simple blockout language:
  - a rear `calf link` element was added to suggest a second structural/support member behind the main shin
  - an additional inner toe support was added so the foot reads less like a single slab and more like a mech footing assembly
  - the thigh block was slimmed again while the added thigh plate remained the dominant armored silhouette
  - the knee and shin were narrowed and lengthened so the visible support chain feels lighter under the armor mass
  - the heel support was kept so the foot now reads as toe + inner support + heel rather than as one flat plate
- `KWII_STRIDE_TEST` was refreshed from that state as well, so stride checks now include the extra mechanical read in the lower leg and foot
- this is still not final lowpoly polish, but the legs now read much more like a mech structure and much less like placeholder boxes with a bend in them
- a final leg-polish pass then tightened the proportions without adding any more major complexity:
  - the thigh armor was narrowed and thinned slightly so it reads as a plate rather than as a second full limb block
  - the knee and shin chain was slimmed and aligned into a cleaner upper-to-lower rhythm
  - the calf link was reduced so it supports the silhouette without overpowering the main shin
  - the foot base, toe, inner toe, and heel were all reduced slightly so the mech keeps a mechanical footing without looking oversized or slab-heavy
- `KWII_STRIDE_TEST` was refreshed from that polished neutral state as well, so the stride pose now inherits the cleaner final leg proportions
- at this point the lower body is still intentionally blocky, but it has crossed from rough construction into a usable hero-mech leg blockout
- after comparing the foot directly against the source screenshots, the landing gear still read too much like a flat plate
- a focused foot pass then adjusted only the support assembly:
  - the main foot plate was narrowed and shortened
  - the heel was strengthened as a clearer rear support
  - the existing front toe and inner toe were tightened
  - an additional outer toe support was added so the foot now reads as a wider multi-point mech foot rather than a single rectangular base
- `KWII_STRIDE_TEST` was refreshed from that state too, so both neutral and stride poses now share the updated foot silhouette
- one final toe-polish pass then tightened the front of the foot without changing the overall leg concept:
  - the main foot plate was reduced slightly again
  - the front toe, inner toe, and outer toe were shortened and brought into a more cohesive three-prong arrangement
  - the heel remained strong enough to keep the foot planted, but the whole support assembly now reads less like a comb of separate bars and more like a compact mech paw
- `KWII_STRIDE_TEST` was refreshed from this version as well, so the refined toe arrangement is present in both neutral and stride views
- after closing the lower-body pass, refinement moved to the shoulder and weapon cluster:
  - the shoulder pods were repositioned and tilted toward a more source-like upper-module silhouette instead of reading as upright blocks
  - the arm roots were brought into a cleaner relationship with the torso and the suspended tank mass
  - a dedicated `gun housing` block was introduced so the barrels are no longer just floating rods through the arm volume
  - the side tanks were adjusted upward/backward to read more like part of the same suspended shoulder-weapon assembly
- `KWII_STRIDE_TEST` was refreshed from that updated upper-body state too, so stride previews keep matching the current hero shell
- a second shoulder/weapon contour pass then pushed the upper cluster closer to the source silhouette:
  - the shoulder pods were lengthened and lowered so they read more like long upper modules and less like upright blocks
  - the arm root was tightened again so the weapon cluster sits as a denser side-mounted package
  - the `gun housing` was enlarged into a more meaningful intermediate mass between the arm root and the barrel
  - the side tank was reduced slightly and repositioned so it supports the under-hanging silhouette instead of overpowering the whole side view
- `KWII_STRIDE_TEST` was refreshed from that version too, keeping stride previews aligned with the current shoulder and gun blockout
- refinement then moved into the torso front and upper-back masses:
  - the torso/front block was shifted and scaled to read as a heavier central chest rather than a thin upright plate
  - the backpack was enlarged and pushed further rearward/upward so the mech carries more of the source asset's top-heavy back silhouette
  - the top cap was broadened and lowered slightly into a more integrated upper-head/upper-back bridge
- `KWII_STRIDE_TEST` was refreshed from those torso/back changes as well, so the stride pose keeps the same heavier upper-body rhythm

Next:
- continue source-faithful hero refinement on the current clean shell:
  - torso front and upper-back contour
  - shoulder / gun housing contour and under-hanging detail rhythm
  - tank contour refinement from the side and 3/4 view
  - bird-leg contour polish in side view
  - knee/foot contour refinement and stance polish
  - hip-to-thigh contour cleanup now that the structural connection exists
- only after silhouette approval, resume:
  - ambiguous high review
  - regional low/high overlap prep
- begin UV/material consolidation once the hero shell stops moving structurally
