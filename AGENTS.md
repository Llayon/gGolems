# Repository Guidelines

## Project Structure & Module Organization
Core game code lives in `src/`. Use `src/core/` for renderer, app bootstrap, and runtime composition. The `Engine.ts` class (~950 lines) owns all subsystems and delegates per-frame logic to pure runtime functions in `src/core/` subdirectories via adapter context factories (`EngineRuntimeContexts.ts`, `EngineSessionRuntimeAdapters.ts`). `src/entities/` contains Golem controllers and bots. `src/combat/` owns weapons and combat rules. `src/mechs/` contains chassis/loadout definitions, rules, and runtime modules. Runtime assets belong in `src/assets/`. Blender exports and reference files live in `docs/blender_exports/`, while repeatable export helpers belong in `scripts/`. GitHub Pages deployment is defined in `.github/workflows/`.

**Extracted modules** (pure functions, testable in isolation):
- `src/core/combat/UnitLocator.ts` — enemy position iteration, nearest target lookup, team resolution
- `src/core/respawn/SpawnSystem.ts` — spawn resolution with LOS checks, death tracking, spawn yaw
- `src/core/bots/BotObjectiveSystem.ts` — bot intent, lane node navigation, control point scoring, retreat/push logic
- `src/core/match/MatchController.ts` — game mode settings application
- `src/core/match/MatchRuntime.ts` — scoring, match restart, team overview

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server on port `3000`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally for verification.
- `npm run lint` runs `tsc --noEmit` and should pass before every push.
- `npm run test:rules` runs deterministic mech-rule fixtures.
- `npm run test:runtime-smoke` runs runtime smoke checks for network, respawn, bot, and combat paths.
- `npm run clean` removes the build output.

Run commands from the repository root:

```bash
npm run dev
npm run lint
npm run build
```

## Coding Style & Naming Conventions
Use TypeScript and existing project conventions. Prefer clear, explicit names and keep files focused on one responsibility. Use `PascalCase` for classes and asset loaders (`KWIIRuntimeAsset.ts`), `camelCase` for variables and functions, and `UPPER_SNAKE_CASE` only for true constants. Match the surrounding file style; keep comments rare and only where the logic is not obvious.

**File size limit:** Keep files under 400 lines. If a file grows beyond this, split it into smaller, focused modules.

## Testing Guidelines
The minimum validation bar for gameplay code is:
- `npm run lint`
- `npm run build`
- `npm run test:rules` for mech/chassis rule changes
- `npm run test:runtime-smoke` for runtime/session/combat changes
- a quick manual gameplay check for rendering, camera, movement, and mech animation changes

When adding tests later, keep them near the related feature or under a dedicated `tests/` directory and name them after the feature they cover.

## Communication

Respond to the user in Russian only. Code comments and explanations may be in English.

## Commit & Pull Request Guidelines

Use the **Conventional Commits** format so that LLMs and tools can parse the history:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix` (required by spec), plus `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`, `style` as needed.

**Rules:**
- Scope goes in parentheses: `fix(mech):`, `feat(combat):`
- Description is a short imperative summary after `: `
- Split commits when a change spans multiple types — one type per commit
- Breaking changes: append `!` before `:` or add `BREAKING CHANGE:` footer

Good: `fix(mech): Fix KWII torso twist for skinned export`. Good: `feat(combat): Add steam_cannon projectile trail`. Bad: `Fix stuff in mech`. Bad: `Update things`.

PRs should include:
- what changed and why
- gameplay or rendering impact
- screenshots or GIFs for visual changes
- notes on asset exports, config changes, or required env vars

## Configuration & Assets
Local config lives in `.env.local`. `VITE_FIREBASE_*` and `VITE_SUPABASE_*` are optional integrations; `GEMINI_API_KEY` remains only for legacy/template compatibility and is not required for core gameplay. Do not hardcode secrets. For new mech assets, keep a repeatable exporter script in `scripts/` and commit only runtime-ready files. Use the canonical docs in `docs/` and `docs/llm-development-guide.md` as the source of truth for subsystem behavior.
