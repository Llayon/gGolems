# Repository Guidelines

## Project Structure & Module Organization
Core game code lives in `src/`. Use `src/core/` for renderer and app bootstrap, `src/entities/` for mechs, controllers, and bots, and `src/combat/` for weapons and combat rules. Runtime assets belong in `src/assets/`, with mech files under `src/assets/mechs/`. Blender exports and reference files live in `docs/blender_exports/`, while repeatable export helpers belong in `scripts/`. GitHub Pages deployment is defined in `.github/workflows/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server on port `3000`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally for verification.
- `npm run lint` runs `tsc --noEmit` and should pass before every push.
- `npm run clean` removes the build output.

Run commands from the repository root:

```bash
npm run dev
npm run lint
npm run build
```

## Coding Style & Naming Conventions
Use TypeScript and existing project conventions. Prefer clear, explicit names and keep files focused on one responsibility. Use `PascalCase` for classes and asset loaders (`KWIIRuntimeAsset.ts`), `camelCase` for variables and functions, and `UPPER_SNAKE_CASE` only for true constants. Match the surrounding file style; keep comments rare and only where the logic is not obvious.

## Testing Guidelines
There is currently no separate automated unit test suite. The minimum validation bar is:
- `npm run lint`
- `npm run build`
- a quick manual gameplay check for rendering, camera, movement, and mech animation changes

When adding tests later, keep them near the related feature or under a dedicated `tests/` directory and name them after the feature they cover.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages such as `Fix KWII torso twist for skinned export` or `Add skinned KWII detailed export from source`. Keep commits narrowly scoped and descriptive. PRs should include:
- what changed and why
- gameplay or rendering impact
- screenshots or GIFs for visual changes
- notes on asset exports, config changes, or required env vars

## Configuration & Assets
Local config lives in `.env.local`. `GEMINI_API_KEY` and optional `VITE_FIREBASE_*` values are read during build. Do not hardcode secrets. For new mech assets, keep a repeatable exporter script in `scripts/` and commit only the runtime-ready files needed by the game.
