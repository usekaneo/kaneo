FROM --platform=$BUILDPLATFORM oven/bun:1 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lockb ./
COPY apps/web/package.json ./apps/web/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/libs/package.json ./packages/libs/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install --no-frozen-lockfile

# Copy only necessary source code
COPY packages/typescript-config ./packages/typescript-config
COPY packages/libs ./packages/libs
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build the application
WORKDIR /app/apps/web
RUN bun run build

# Production stage with pinned version
FROM nginx:alpine

# Create non-root user for nginx
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -D appuser && \
    # Set permissions for nginx directories
    chown -R appuser:appuser /var/cache/nginx && \
    chmod -R 755 /var/cache/nginx && \
    # Create directory for pid file
    mkdir -p /var/run/nginx && \
    chown -R appuser:appuser /var/run/nginx && \
    chmod -R 755 /var/run/nginx && \
    # Set permissions for nginx configuration
    touch /var/run/nginx.pid && \
    chown appuser:appuser /var/run/nginx.pid && \
    chmod 644 /var/run/nginx.pid && \
    # Update nginx configuration to run as non-root
    sed -i 's/user  nginx;/user  appuser;/' /etc/nginx/nginx.conf && \
    # Remove the user directive completely to avoid warnings
    sed -i 's/user  appuser;//' /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder --chown=appuser:appuser /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY --chown=appuser:appuser apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy and set permissions for environment script
COPY --chown=appuser:appuser apps/web/env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

# Switch to non-root user
USER appuser

EXPOSE 80

# Use exec form of CMD for proper signal handling
CMD ["nginx", "-g", "daemon off;"]
