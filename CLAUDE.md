@AGENTS.md

## Claude Code specifics

- `AGENTS.md` (imported above) is the shared instruction file for all agents — put project rules
  there, not here. Keep this file for Claude-only notes.
- The spec is ~2,500 lines: read only the sections the table in `AGENTS.md` points to, using
  offsets, instead of loading the whole file.
- For Next.js work, `apps/web/AGENTS.md` (generated and re-added by `next dev`) also applies.
- The local Directus API is reachable at `http://localhost:8055` when `pnpm stack:up` is running;
  see `docs/DIRECTUS_API.md` for the token location. Read-only exploration is fine; schema or
  permission changes must end up in `directus/snapshots/` and the docs.
