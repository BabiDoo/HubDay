FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy project files (.dockerignore excludes host node_modules, dist, .git)
COPY . .

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Build contracts and api
RUN pnpm --filter @hubday/contracts build
RUN pnpm --filter @hubday/api build

# Strip CRLF on entrypoint script and make executable
RUN tr -d '\r' < /app/apps/api/docker-entrypoint.sh > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
