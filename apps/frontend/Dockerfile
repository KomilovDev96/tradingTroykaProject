# Build context: repo root (npm workspaces).
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/strategy-engine/package.json packages/strategy-engine/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=@troyka/frontend --include-workspace-root=false

COPY packages/strategy-engine packages/strategy-engine
COPY apps/frontend apps/frontend
ARG VITE_BACKEND_HTTP_URL
ARG VITE_BACKEND_WS_URL
ENV VITE_BACKEND_HTTP_URL=$VITE_BACKEND_HTTP_URL VITE_BACKEND_WS_URL=$VITE_BACKEND_WS_URL
RUN npm run build --workspace=@troyka/frontend

FROM nginx:1.27-alpine
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
