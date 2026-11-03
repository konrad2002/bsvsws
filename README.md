# BSV-SWS Website

New website of the Bezirksschwimmverband Südwestsachsen, replacing the Joomla site at
https://bsv-sws.de/.

Next.js · Fastify · Directus · PostgreSQL · pnpm + Turborepo · Docker Compose

## Quick start

Requires Node.js 24, pnpm 12 and Docker.

```bash
cp .env.example .env
pnpm install
pnpm stack:up   # PostgreSQL + Directus → http://localhost:8055
pnpm dev        # web → http://localhost:3000, api → http://localhost:4000
```

## Documentation

- [Project specification](docs/PROJECT_SPECIFICATION.md)
- [Documentation index](docs/README.md)
- [Agent instructions](AGENTS.md)
