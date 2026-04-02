# LLM Development Guide

> Status: Canonical reference  
> Scope: Repo navigation, documentation precedence, and update rules for an LLM-first workflow.

## Purpose

Provide the operating rules for contributors who primarily modify this codebase through LLM-driven sessions.

## Current Architecture and Responsibilities

- `README.md` is the project entrypoint.
- `docs/README.md` is the documentation index.
- Canonical subsystem docs describe current behavior.
- Operational guides describe setup and deployment.
- Plan docs describe migration history or future work and must not be used as the default current-state source.

## Key Contracts, Types, or Interfaces

Source-of-truth order:

1. Code is final when docs drift.
2. Canonical reference docs are the written source of truth for current behavior.
3. Operational guides describe environment and deployment procedures.
4. Implementation plans are historical or forward-looking context.
5. `AGENTS.md` defines contributor workflow, not runtime architecture truth.

Canonical docs by topic:

- overall architecture: [architecture-overview.md](architecture-overview.md)
- runtime/session behavior: [runtime-reference.md](runtime-reference.md)
- mechs and loadouts: [mech-system-reference.md](mech-system-reference.md)
- networking and services: [networking-reference.md](networking-reference.md)
- assets/export pipeline: [content-pipeline.md](content-pipeline.md)
- validation: [testing-and-validation.md](testing-and-validation.md)

## Data Flow and Working Flow

1. Start at `README.md`, then `docs/README.md`.
2. Read the canonical doc for the subsystem you are about to touch.
3. Read the relevant plan doc only if you need migration history or unfinished roadmap context.
4. Make the code change.
5. Update the canonical doc for that subsystem in the same change series.
6. Run the matching validation commands from [testing-and-validation.md](testing-and-validation.md).

## Update Rules

- Runtime/session/combat/network changes must update [runtime-reference.md](runtime-reference.md) or [networking-reference.md](networking-reference.md) as appropriate.
- Mech/chassis/loadout/rule changes must update [mech-system-reference.md](mech-system-reference.md).
- Asset/export contract changes must update [content-pipeline.md](content-pipeline.md).
- UI shell or top-level structure changes must update [architecture-overview.md](architecture-overview.md).
- Validation/tooling changes must update [testing-and-validation.md](testing-and-validation.md).
- Environment/setup changes must update the relevant operational guide and root `README.md`.

## Extension Points

- Add a new canonical doc only when a subsystem no longer fits its existing canonical file.
- Keep one obvious canonical doc per topic; avoid duplicating current behavior across multiple files.
- Mark new non-canonical docs explicitly as `Implementation plan` or `Historical/reference only`.

## Validation and Failure Modes

- If a doc describes planned behavior as if it were live, fix the status or move the text.
- If more than one doc claims to be the canonical current source for the same topic, collapse the duplication.
- If a code change lands without the matching canonical doc update, the documentation workflow has failed even if the build passes.

## Related Documents

- [../AGENTS.md](../AGENTS.md)
- [architecture-overview.md](architecture-overview.md)
- [testing-and-validation.md](testing-and-validation.md)
