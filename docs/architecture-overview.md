# Architecture Overview

> Status: Canonical reference  
> Scope: Current top-level architecture and subsystem boundaries.

## Purpose

Explain how the UI shell, runtime, gameplay domains, assets, and backend integrations fit together today.

## Current Architecture and Responsibilities

- `src/main.tsx` mounts the React shell.
- `src/App.tsx` is the top-level screen composer for lobby, desktop combat HUD, and mobile combat layouts.
- `src/app/` contains UI-to-runtime hooks such as `useGameSession`, `usePilotAccount`, and `useFirebaseLobbyRooms`.
- `src/ui/` contains presentational layouts and device-specific views. `src/ui/lobby/` owns lobby layouts; `src/ui/combat/` owns desktop cockpit HUD; `src/ui/mobile/` owns touch combat layouts.
- `src/core/` contains the runtime composition root in `Engine.ts` plus match, combat, networking, respawn, bot, and world runtimes.
- `src/entities/` contains actor facades such as `GolemController` and `DummyBot`.
- `src/mechs/` contains chassis/loadout definitions, pure mech rules, and split mech runtime modules.
- `src/world/`, `src/gameplay/`, `src/camera/`, `src/combat/`, and `src/fx/` hold the world scene, game-mode logic, camera, projectile manager, and effects.
- `src/network/NetworkManager.ts` is the low-level PeerJS transport wrapper.
- `src/firebase/` handles optional public lobby registration.
- `src/supabase/` handles optional pilot account, profile, progression, and match-history features.

## Key Contracts, Types, or Interfaces

- `GameHudState` in `src/core/gameHudState.ts` is the main runtime-to-UI contract.
- `useGameSession` is the UI bridge into `initGame` and session startup/teardown.
- Chassis and loadout contracts live in `src/mechs/types.ts` and `src/mechs/definitions.ts`.
- Runtime-ready mech assets must preserve the mech runtime asset contract documented in [mech-system-reference.md](mech-system-reference.md).

## Data Flow and Runtime Flow

1. `main.tsx` mounts `App`.
2. `App` builds device, locale, pilot, and lobby state through hooks in `src/app/`.
3. `useGameSession` calls `initGame` from `src/core/Engine.ts`.
4. `Engine.ts` creates the render/physics/runtime session, then publishes `GameHudState` updates back to React.
5. UI reads `GameHudState` and renders desktop or mobile combat layouts.
6. Optional Firebase and Supabase layers remain outside the main gameplay loop and only supplement lobby discovery or pilot persistence.

## Extension Points

- Add new lobby or combat presentations inside `src/ui/` without moving session side effects back into `App`.
- Add new mech content through `src/mechs/` and runtime-ready assets in `src/assets/mechs/`.
- Add new runtime behaviors by extending `src/core/` domain runtimes instead of growing `Engine.ts`.
- Add service integrations in `src/firebase/` or `src/supabase/` without making them authoritative for gameplay transport.

## Validation and Failure Modes

- If `App.tsx` starts re-absorbing session, auth, or runtime logic, the shell boundary has regressed.
- If `Engine.ts` starts depending on UI or service layers directly, the runtime boundary has regressed.
- Use [testing-and-validation.md](testing-and-validation.md) to choose the right automated and manual checks after architectural changes.

## Related Documents

- [runtime-reference.md](runtime-reference.md)
- [mech-system-reference.md](mech-system-reference.md)
- [networking-reference.md](networking-reference.md)
- [llm-development-guide.md](llm-development-guide.md)
