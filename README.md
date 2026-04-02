<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# gGolems

Stylized networked mech combat prototype built with `React`, `Vite`, `Three.js`, and `Rapier`. The project mixes a desktop/mobile cockpit UI, peer-to-peer matches over `PeerJS`, optional Firebase public room discovery, and optional Supabase-backed pilot/progression features.

This repository is maintained as an `LLM-first` codebase: documentation is part of the implementation surface, not an afterthought. Start with the docs map before changing subsystems.

## Quickstart

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`.
3. Fill optional integrations as needed:
   - `VITE_FIREBASE_*` for the public room browser
   - `VITE_SUPABASE_*` for pilot accounts, progression, and match history
   - `GEMINI_API_KEY` only if you still use legacy template-era Gemini helpers; core gameplay does not require it
4. Start the dev server:

   ```bash
   npm run dev
   ```

## Core Commands

- `npm run dev` starts the local Vite server on port `3000`.
- `npm run lint` runs `tsc --noEmit`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run test:rules` runs deterministic mech-rule fixtures.
- `npm run test:runtime-smoke` runs runtime-level smoke coverage for networking, respawn, bots, and combat paths.

## Documentation Map

- [docs/README.md](docs/README.md) is the main index for project documentation.
- [docs/architecture-overview.md](docs/architecture-overview.md) explains how `App`, `ui`, `core`, `mechs`, `world`, and service layers fit together.
- [docs/runtime-reference.md](docs/runtime-reference.md) covers the current runtime/session architecture.
- [docs/mech-system-reference.md](docs/mech-system-reference.md) covers chassis, loadouts, mech rules, and runtime mech modules.
- [docs/networking-reference.md](docs/networking-reference.md) covers PeerJS, Firebase lobby behavior, authoritative state flow, and Supabase boundaries.
- [docs/content-pipeline.md](docs/content-pipeline.md) covers tracked assets, Blender/export scripts, and local-only source packs.
- [docs/testing-and-validation.md](docs/testing-and-validation.md) lists the expected validation commands and manual smoke checks.
- [docs/llm-development-guide.md](docs/llm-development-guide.md) explains how LLM contributors should navigate and update the repo.

## Stack and Runtime Notes

- `React 19` powers the lobby, combat HUD, and mobile overlays.
- `Three.js` and `Rapier` power the render/physics runtime.
- `PeerJS` handles live gameplay transport.
- `Firebase Realtime Database` is optional and only provides a public lobby list.
- `Supabase` is optional and powers pilot account/progression features.
- GitHub Pages deployment is handled from `main` by GitHub Actions.

## Setup Guides

- [docs/firebase-lobby-setup.md](docs/firebase-lobby-setup.md)
- [docs/supabase-setup.md](docs/supabase-setup.md)

## Contributing

- [AGENTS.md](AGENTS.md) is the contributor guide.
- For architecture and subsystem truth, prefer the canonical docs in [`docs/`](docs/README.md) over older plan documents.
- When code changes, update the relevant canonical reference doc in the same change series.
