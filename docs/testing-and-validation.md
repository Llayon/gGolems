# Testing and Validation

> Status: Canonical reference  
> Scope: Current automated and manual validation expectations.

## Purpose

Describe the minimum validation bar for code, runtime, and content changes.

## Current Architecture and Responsibilities

- Type safety is enforced through `npm run lint` (`tsc --noEmit`).
- Production bundling is validated through `npm run build`.
- Deterministic mech-rule coverage lives in `npm run test:rules`.
- Runtime/session/network smoke coverage lives in `npm run test:runtime-smoke`.
- Browser/manual gameplay checks remain required for layout, rendering, feel, and live session regressions.

## Key Contracts, Types, or Interfaces

- `test:rules` validates section state, steam/overheat, weapon readiness, and loadout legality.
- `test:runtime-smoke` validates representative runtime flows such as message dispatch, authoritative apply, respawn, bots, remote fire, and hit resolution.

## Data Flow and Validation Flow

### Baseline

- `npm run lint`
- `npm run build`

### Add when changing mech rules or chassis data

- `npm run test:rules`

### Add when changing runtime/session/network/combat orchestration

- `npm run test:runtime-smoke`

### Add manual smoke when changing UX or live feel

- desktop lobby and combat UI
- mobile portrait and mobile landscape layouts
- solo session start/exit
- host/client join flow
- mech movement, aiming, fire, respawn, and control-point interactions

## Extension Points

- Expand `test:rules` when more mech rules become deterministic and pure.
- Expand `test:runtime-smoke` when more runtime systems gain stable DTO-driven entrypoints.
- Keep browser smoke small and scenario-based rather than relying only on large manual play sessions.

## Validation and Failure Modes

- Passing `lint` and `build` is not enough for networking or combat changes.
- Passing `test:rules` does not guarantee runtime wiring is correct.
- Passing `test:runtime-smoke` does not guarantee layout or UX quality.
- If a subsystem changes and no matching validation path exists, add one or document the manual gap in the same change series.

## Related Documents

- [runtime-reference.md](runtime-reference.md)
- [mech-system-reference.md](mech-system-reference.md)
- [llm-development-guide.md](llm-development-guide.md)
