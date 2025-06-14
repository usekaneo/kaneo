# Build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Install build dependencies in a single layer
RUN apk add --no-cache python3 make g++ && \
    corepack enable && \
    corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy only package files first for better caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/typescript-config ./packages/typescript-config
COPY packages/libs ./packages/libs
COPY apps/api ./apps/api

# Fix TypeScript config and build in one layer
WORKDIR /app/apps/api
RUN sed -i 's/"extends": "@kaneo\/typescript-config\/base.json"/"extends": "..\/..\/packages\/typescript-config\/base.json"/g' /app/apps/api/tsconfig.json && \
    pnpm run build

# Production stage - use specific version tag without SHA256
FROM node:20.12-alpine AS runtime

# Set up user in a single layer
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -D appuser && \
    mkdir -p /app/apps/api/data && \
    chown -R appuser:appuser /app

WORKDIR /app

# Copy package files for production install
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/typescript-config/package.json ./packages/typescript-config/
COPY --from=builder /app/packages/libs/package.json ./packages/libs/

# Install production dependencies only
RUN sed -i 's/"prepare": "husky"/"prepare": ""/g' package.json && \
    corepack enable && \
    corepack prepare pnpm@10.7.0 --activate && \
    HUSKY=0 NODE_ENV=production pnpm install --prod --frozen-lockfile --no-optional

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user
USER appuser
WORKDIR /app/apps/api
EXPOSE 1337

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/me || exit 1

CMD ["node", "--enable-source-maps", "dist/index.js"]