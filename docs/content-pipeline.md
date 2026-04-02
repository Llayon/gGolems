# Content Pipeline

> Status: Canonical reference  
> Scope: Current asset workflow, tracked runtime assets, and local-only source content rules.

## Purpose

Explain how art and mech content move from local source packs into runtime-ready files inside the repo.

## Current Architecture and Responsibilities

- Runtime-ready game assets live under `src/assets/`, especially `src/assets/mechs/`.
- Repeatable export helpers live in `scripts/`.
- Working references and selected Blender exports live in `docs/blender_exports/`.
- Large external source packs stay local and are intentionally ignored by `.gitignore`.

## Key Contracts, Types, or Interfaces

- Runtime mechs must satisfy the asset contract documented in [mech-system-reference.md](mech-system-reference.md).
- Export scripts should be repeatable and checked in when they are part of the production workflow.
- The repo tracks runtime-ready outputs, not every upstream marketplace/source download.

## Data Flow and Runtime Flow

1. Acquire or build source content locally.
2. Prepare or iterate on Blender or other working scenes.
3. Export runtime-ready `glb` and companion metadata with a repeatable script when possible.
4. Commit only the files the game runtime actually needs.
5. Keep heavy source packs and one-off exploratory outputs out of git.

## Tracked vs Local-Only Content

Tracked:

- runtime-ready mech assets in `src/assets/mechs/`
- repeatable exporters in `scripts/`
- selected reference/workspace files in `docs/blender_exports/` when they are part of the maintained pipeline

Local-only or ignored:

- external packs such as `mech-robot-kw-ii/`, `free-skybox-savanna/`, `Medieval Village MegaKit*/`, and other marketplace/source downloads
- exploratory scripts and generated previews called out in `.gitignore`
- temporary or test exports such as experimental `glb` outputs

## Extension Points

- Add new exporter scripts in `scripts/` when the workflow becomes repeatable.
- Keep source-pack-specific notes in plan/reference docs, but keep runtime truth in tracked canonical docs.
- When adding a new mech family, document its asset contract impact in [mech-system-reference.md](mech-system-reference.md).

## Validation and Failure Modes

- Validate exported content in the running game, not only in Blender.
- Run `npm run build` after adding or swapping tracked runtime assets.
- If a workflow depends on local files that are not documented here or ignored intentionally, add the note before relying on that path.
- If large source packs or ad hoc exports start entering git, the content boundary has regressed.

## Related Documents

- [mech-system-reference.md](mech-system-reference.md)
- [kwii-hero-adaptation-plan.md](kwii-hero-adaptation-plan.md)
- [testing-and-validation.md](testing-and-validation.md)
