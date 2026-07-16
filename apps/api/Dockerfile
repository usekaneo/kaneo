# Build stage
FROM --platform=$BUILDPLATFORM node:20.20.2-alpine AS builder

# Install build dependencies in a single layer
RUN apk add --no-cache python3 make g++ && \
  corepack enable && \
  corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy only package files first for better caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/email/package.json ./packages/email/
COPY packages/libs/package.json ./packages/libs/
COPY packages/permissions/package.json ./packages/permissions/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/typescript-config ./packages/typescript-config
COPY packages/email ./packages/email
COPY packages/libs ./packages/libs
COPY packages/permissions ./packages/permissions
COPY i18n ./i18n
COPY apps/api ./apps/api

# Build email package first
WORKDIR /app/packages/email
RUN pnpm run build

# Build permissions package
WORKDIR /app/packages/permissions
RUN pnpm run build

# Fix TypeScript config and build API
WORKDIR /app/apps/api
RUN sed -i 's/"extends": "@kaneo\/typescript-config\/base.json"/"extends": "..\/..\/packages\/typescript-config\/base.json"/g' /app/apps/api/tsconfig.json && \
  pnpm run build

# Production dependencies stage - runs on the BUILD platform (native, no QEMU emulation).
# All API runtime deps are pure JavaScript (bcrypt was replaced with bcryptjs), so the
# resulting node_modules is architecture-independent and safe to copy into the arm64 runtime.
FROM --platform=$BUILDPLATFORM node:20.20.2-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY packages/email/package.json ./packages/email/
COPY packages/permissions/package.json ./packages/permissions/
COPY apps/api/package.json ./apps/api/

RUN sed -i 's/"prepare": "husky"/"prepare": ""/g' package.json && \
  HUSKY=0 NODE_ENV=production pnpm install --prod --frozen-lockfile --no-optional

# Production stage - use specific version tag without SHA256
FROM node:20.20.2-alpine AS runtime

# Set up user in a single layer
RUN addgroup -g 1001 appuser && \
  adduser -u 1001 -G appuser -D appuser && \
  mkdir -p /app/apps/api/data && \
  chown -R appuser:appuser /app

WORKDIR /app
ENV NODE_ENV=production

# Production node_modules built natively on the build platform (pure JS, arch-independent)
COPY --from=prod-deps --chown=appuser:appuser /app ./

# Built application and workspace packages
COPY --from=builder --chown=appuser:appuser /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:appuser /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=appuser:appuser /app/packages/email ./packages/email
COPY --from=builder --chown=appuser:appuser /app/packages/permissions ./packages/permissions

# Fail the build early if the runtime dependency layout is broken on the target architecture
RUN cd /app/apps/api && node -e "const fs=require('fs');for(const m of ['bcryptjs','hono','pg','drizzle-orm','better-auth','ioredis','valibot','octokit','@modelcontextprotocol/sdk']){fs.accessSync('node_modules/'+m+'/package.json')}"

# Switch to non-root user
USER appuser
WORKDIR /app/apps/api
EXPOSE 1337

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:1337/api/health || exit 1

CMD ["node", "--enable-source-maps", "dist/index.js"]
