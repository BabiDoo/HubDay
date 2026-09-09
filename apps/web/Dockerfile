# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy project files (.dockerignore excludes host node_modules, dist, .git)
COPY . .

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Build contracts and web SPA
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @hubday/contracts build
RUN pnpm --filter @hubday/web build

# Stage 2: Production Nginx Server
FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
