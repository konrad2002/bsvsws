# Fastify API image. Build context: repository root.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
RUN npm install -g turbo@2.11.10
COPY . .
RUN turbo prune @bsv-sws/api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@bsv-sws/api...
RUN pnpm --filter=@bsv-sws/api deploy --prod --legacy /prod/api

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /prod/api ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
