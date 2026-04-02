# Mech Roster Architecture

> Status: Implementation plan  
> Current relevance: Active roadmap for long-term mech content. Use `mech-system-reference.md` for currently implemented chassis, loadouts, and runtime contracts.

## Goal

Build toward a long-term roster of roughly 30 mechs without creating 30 unrelated rulesets. The game should feel like a hybrid of `BattleTech` and `Lancer`: readable PvP fundamentals first, stronger chassis flavor second.

## Core Model

The roster is split into four layers:

1. `FrameFamilyDefinition`
   Shared role and combat identity, such as duelist, ranger, or bulwark.
2. `ChassisDefinition`
   Concrete frame stats: weight class, speed band, steam pool, section armor, mount layout, and signature access.
3. `LoadoutDefinition`
   Weapon assignments for the chassis. This is where mount compatibility lives.
4. `SignatureAbilityDefinition`
   Stronger rule-breaking mechanics. In v1, a chassis should expose at most one signature.

This keeps the content goal large while the mechanical surface stays manageable.

## V1 Scope

The first production milestone should target:

- `6-8` chassis
- `12-18` weapons
- `4-6` utility or defense modules
- no more than `2` truly exotic mechanics

The current codebase implements the first foundation step:

- chassis data
- loadout data
- family and signature registries
- slot compatibility checks
- runtime selection of section HP, mass, speed, dash speed, and mount assignments from definitions

## Asset Contract

All mechs should keep the same minimum runtime contract:

- `viewAnchor`
- `leftArmMount`
- `rightArmMount`
- `torsoMount`

This lets visual variants swap in without rewriting the controller, camera, or projectile logic.

## Balance Rules

The project should avoid unrestricted weapon mixing. Instead:

- each slot has a class, such as `arm` or `torso`
- each weapon declares allowed slot classes
- each chassis has a fixed mount layout

Balance should be tuned through four budgets:

- offense
- mobility
- durability
- heat/steam economy

Different mechs can share a family while feeling distinct through budget shifts, section armor redistribution, and loadout changes.

## Content Strategy

Long-term `30 mechs` should mean:

- `6-8` mechanical families or chassis skeletons
- many visual, statistical, and loadout variants inside those families

That is cheaper to balance, easier to animate, and more resilient for PvP than treating every mech as a bespoke combat system.

## Near-Term Roadmap

1. Add more chassis definitions before adding more art.
2. Add weapon compatibility and loadout UI.
3. Add utility modules and passive chassis perks.
4. Add limited signature abilities.
5. Expand the visual roster once the ruleset is stable.
