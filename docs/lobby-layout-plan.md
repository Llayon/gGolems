# Lobby Layout Plan

> Status: Implementation plan  
> Current relevance: Implemented. Keep this file as layout migration history; use `architecture-overview.md` for the live lobby split and shell boundaries.

## Summary
The current lobby is structurally correct but overloaded because one vertical layout serves desktop, mobile portrait, and mobile landscape. The next UI pass should separate `content`, `view model`, and `layout`, then provide three device-specific lobby experiences without duplicating session logic.

## Goals
- Reduce first-screen overload on all devices.
- Keep all session/auth/start/join logic shared.
- Use the same lobby sections across layouts.
- Make `mobile portrait` step-based instead of scroll-based.
- Keep `App.tsx` free of orientation-specific lobby JSX.

## Non-Goals
- No gameplay or networking changes.
- No new authentication flows.
- No redesign of combat HUD in this pass.
- No duplication of business logic inside layout components.

## Information Priority
- Desktop: `mode`, `mech`, `start/join`, `rooms` visible immediately.
- Mobile portrait: one primary decision at a time.
- Mobile landscape: `mech` and `session` side by side; rooms/account secondary.

## Layout Model
1. `LobbyViewModel`
- Derived labels, availability, warnings, direct-join state, room counts.
- No JSX, no side effects.

2. `Lobby Sections`
- `LobbyModeSection`
- `LobbyChassisSection`
- `LobbyLoadoutSection`
- `LobbySessionSection`
- `LobbyRoomBrowserSection`
- `LobbyPilotSection`

3. `LobbyRoot`
- Chooses one of:
  - `DesktopLobbyLayout`
  - `MobilePortraitLobbyLayout`
  - `MobileLandscapeLobbyLayout`

## Interaction Model
### Desktop
- Multi-column dashboard.
- Left: mode + session actions.
- Center: chassis + loadout.
- Right: pilot + room browser.

### Mobile Portrait
- Step flow, not a long scroll.
- Steps:
  1. `Mode`
  2. `Mech`
  3. `Session`
- `Pilot` and `Rooms` move into secondary sheets/panels.

### Mobile Landscape
- Two-pane layout.
- Primary pane: mech and loadout.
- Secondary pane: solo/host/join actions.
- `Pilot` and `Rooms` stay compact or collapsible.

## Layout Contract
- Layout components compose shared section components only.
- Layout components do not own auth/session side effects.
- `App.tsx` renders `LobbyRoot`, not device-specific branches.
- `LobbyRoot` decides layout from touch/orientation/viewport state.

## Implementation Phases
1. Create `buildLobbyViewModel.ts`.
2. Split the current lobby into shared section components.
3. Add `LobbyRoot.tsx`.
4. Implement `DesktopLobbyLayout.tsx`.
5. Implement `MobilePortraitLobbyLayout.tsx` with step flow.
6. Implement `MobileLandscapeLobbyLayout.tsx`.
7. Move room browser and pilot account into secondary surfaces where needed.

## Validation Matrix
- Desktop 16:9.
- Narrow laptop width.
- Phone portrait.
- Phone landscape.
- Tablet portrait.
- Tablet landscape.
- Solo start.
- Host create.
- Direct join.
- Firebase room browser.
- Pilot account signed out / partial / linked.

## Definition of Done
- `LobbyScreen.tsx` is no longer one overloaded layout file.
- Mobile portrait no longer relies on a full vertical scroll to expose all actions.
- Desktop exposes primary gameplay decisions without deep scrolling.
- The same session handlers power all layouts.
- `App.tsx` remains a shell and does not regain lobby complexity.
