FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

# Copy workspace config and root package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files from the monorepo
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/typescript-config ./packages/typescript-config
COPY packages/libs ./packages/libs
COPY apps/api ./apps/api

# Fix TypeScript config to use relative path
RUN sed -i 's/"extends": "@kaneo\/typescript-config\/base.json"/"extends": "..\/..\/packages\/typescript-config\/base.json"/g' /app/apps/api/tsconfig.json

# Build the application
WORKDIR /app/apps/api
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runtime

# Install SQLite
RUN apk add --no-cache sqlite

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -D appuser

WORKDIR /app

# Copy package files for production install
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/typescript-config/package.json ./packages/typescript-config/
COPY --from=builder /app/packages/libs/package.json ./packages/libs/

# Temporarily modify package.json to remove husky prepare script
RUN sed -i 's/"prepare": "husky"/"prepare": ""/g' package.json

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate && \
    HUSKY=0 NODE_ENV=production pnpm install --prod --frozen-lockfile --no-optional

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle

# Create data directory with proper permissions
RUN mkdir -p /app/apps/api/data && \
    chown -R appuser:appuser /app

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user
USER appuser

WORKDIR /app/apps/api

EXPOSE 1337

CMD ["node", "--enable-source-maps", "dist/index.js"]