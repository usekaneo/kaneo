FROM --platform=$BUILDPLATFORM oven/bun:1 AS base
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package.json bun.lockb ./
COPY apps/api/package.json ./apps/api/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN bun install --no-frozen-lockfile

# Copy source code
COPY packages/typescript-config ./packages/typescript-config
COPY apps/api ./apps/api

# Production stage
FROM oven/bun:1-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -D appuser

WORKDIR /app/apps/api

# Create data directory with proper permissions
RUN mkdir -p /app/apps/api/data && \
    chown -R appuser:appuser /app

# Copy built files from base stage
COPY --from=base --chown=appuser:appuser /app/apps/api ./
COPY --from=base --chown=appuser:appuser /app/node_modules ../node_modules
COPY --from=base --chown=appuser:appuser /app/packages ../packages

# Set environment variables
ENV NODE_ENV=production
ENV BUN_ENV=production

# Switch to non-root user
USER appuser

EXPOSE 1337

# Use exec form of CMD for proper signal handling
CMD ["bun", "run", "/app/apps/api/src/index.ts"]
