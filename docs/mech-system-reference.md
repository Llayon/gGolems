# Mech System Reference

> Status: Canonical reference  
> Scope: Current chassis/loadout model, mech rules, and runtime mech architecture.

## Purpose

Document the live mech architecture that supports chassis selection, loadouts, rules, and runtime control.

## Current Architecture and Responsibilities

- `src/mechs/definitions.ts` contains frame families, chassis, loadouts, default selection, and validation helpers.
- `src/mechs/types.ts` defines the data contracts for families, chassis, signatures, mounts, and loadouts.
- `src/mechs/sections.ts` defines section state and aggregate HP helpers.
- `src/mechs/rules/` contains pure deterministic rules for sections, steam/overheat, and weapon readiness.
- `src/mechs/runtime/` contains split runtimes for local movement, remote replication, weapon runtime, damage/state bridge, visual driving, and camera/footstep integration.
- `src/entities/GolemController.ts` is now a thin mech facade/orchestrator, not the full mech rules implementation.

## Key Contracts, Types, or Interfaces

- `FrameFamilyDefinition`, `ChassisDefinition`, `LoadoutDefinition`, and `SignatureAbilityDefinition` are the canonical content-layer contracts.
- Live chassis currently include:
  - `kwii_strider`
  - `courier_scout`
  - `bastion_siege`
- Runtime-ready mech assets must provide:
  - `viewAnchor`
  - `leftArmMount`
  - `rightArmMount`
  - `torsoMount`

## Data Flow and Runtime Flow

1. Lobby UI selects `chassisId` and `loadoutId`.
2. `useGameSession` passes the selected values into `initGame`.
3. `Engine.ts` creates `GolemController` with those IDs.
4. `GolemController` reads chassis/loadout definitions and delegates to mech runtimes and pure rules.
5. Mech state feeds back into runtime HUD state, networking, damage, and weapon fire requests.

## Extension Points

- Add new chassis or loadouts in `src/mechs/definitions.ts` before adding bespoke runtime logic.
- Keep weapon compatibility data-driven through mount classes instead of hardcoding per-mech exceptions.
- Add new mech visuals by matching the runtime asset contract instead of forking controller logic.
- Use pure rules plus runtime fixtures before adding more mech-side side effects.

## Validation and Failure Modes

- Run `npm run test:rules` after changing chassis, loadouts, sections, steam rules, or weapon rules.
- Run `npm run test:runtime-smoke` when mech changes affect runtime/session behavior.
- Run `npm run lint` and `npm run build` after mech runtime refactors.
- If a new mech requires one-off controller code outside the asset contract, treat that as an architecture smell.

## Related Documents

- [mech-roster-architecture.md](mech-roster-architecture.md)
- [content-pipeline.md](content-pipeline.md)
- [testing-and-validation.md](testing-and-validation.md)
