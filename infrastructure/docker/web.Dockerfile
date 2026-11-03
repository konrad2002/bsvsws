# Next.js web image (standalone output). Build context: repository root.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
RUN npm install -g turbo@2.11.10
COPY . .
RUN turbo prune @bsv-sws/web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@bsv-sws/web...

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
