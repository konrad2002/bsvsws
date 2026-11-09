# Directus configuration tooling (apply schema/permissions, Joomla migration) for
# deployed environments. Runs once per deploy on the Compose network, so the setup
# and service tokens never leave the server. Build context: repository root.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
RUN npm install -g turbo@2.11.10
COPY . .
RUN turbo prune @bsv-sws/directus-tools --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@bsv-sws/directus-tools^...

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app ./
# Schema source of truth (not a workspace package, so not part of the prune output).
COPY --chown=node:node directus/snapshots/ ./directus/snapshots/
USER node
WORKDIR /app/directus/tools
# Usage: docker compose run --rm tools apply | migrate-joomla [--apply]
ENTRYPOINT ["pnpm", "--silent", "run"]
CMD ["apply"]
