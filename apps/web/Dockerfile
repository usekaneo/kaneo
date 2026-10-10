# syntax=docker/dockerfile:1
# Build stage
FROM --platform=$BUILDPLATFORM node:24.19.0-alpine AS builder

# Sentry org/project are public identifiers (not secrets). The auth token
# is the only real secret; it is mounted via `--mount=type=secret` during
# the pnpm build step so it never lands in any layer or image metadata.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT

# Install build dependencies in a single layer
RUN apk add --no-cache python3 make g++ && \
  corepack enable && \
  corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy package files first for better layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json vite.config.ts ./
COPY apps/web/package.json ./apps/web/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY packages/permissions/package.json ./packages/permissions/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy only necessary source code
COPY packages/typescript-config ./packages/typescript-config
COPY packages/libs ./packages/libs
COPY packages/permissions ./packages/permissions
COPY i18n ./i18n
COPY apps/web ./apps/web

# Build the permissions package first
WORKDIR /app/packages/permissions
RUN pnpm run build

# Build the application
WORKDIR /app/apps/web
# SENTRY_AUTH_TOKEN is optional: only mounted during container builds that
# need it (e.g., the publish workflows). Local or CI builds without the
# secret still succeed; the build just runs without it.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,required=false \
    if [ -f /run/secrets/SENTRY_AUTH_TOKEN ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; fi; \
    pnpm run build && find dist -type f -name '*.map' -delete

# Production stage with specific version
FROM nginx:1.29.5-alpine AS runtime

# Only runtime storage needs write access, including for an arbitrary UID.
RUN addgroup -g 1001 appuser && \
  adduser -u 1001 -G appuser -D appuser && \
  mkdir -p /var/lib/kaneo && \
  chown appuser:root /var/lib/kaneo && \
  chmod 2775 /var/lib/kaneo

# Copy built files from builder stage
COPY --from=builder --chown=appuser:appuser /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration and public runtime configuration renderer
COPY apps/web/nginx.main.conf /etc/nginx/nginx.conf
COPY --chown=appuser:appuser apps/web/nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R appuser:appuser /etc/nginx/conf.d

# Copy and set permissions for environment script
COPY --chown=appuser:appuser apps/web/env.sh /docker-entrypoint.d/env.sh
COPY --chown=appuser:appuser apps/web/env.awk /docker-entrypoint.d/env.awk
RUN chmod +x /docker-entrypoint.d/env.sh

# Switch to non-root user
ENV TMPDIR=/var/lib/kaneo/tmp
USER 1001:0
EXPOSE 5173

# Use exec form of CMD for proper signal handling
CMD ["nginx", "-g", "daemon off;"]
