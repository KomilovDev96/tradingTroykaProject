# Build context: repo root (npm workspaces). Runs TS via tsx — the engine package ships as TS source.
# Full (non-slim) image: ships openssl, which Prisma needs — no apt-get, no Debian mirror dependency.
FROM node:20-bookworm
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/strategy-engine/package.json packages/strategy-engine/
COPY apps/backend/package.json apps/backend/
RUN npm ci --workspace=@troyka/backend --include-workspace-root=false

COPY packages/strategy-engine packages/strategy-engine
COPY apps/backend apps/backend
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma

WORKDIR /app/apps/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
