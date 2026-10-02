# Production deploy

- Live at https://brokerkillers.uz (DNS A @ and www → 195.216.169.108, registrar Ahost). Server: Ubuntu 26.04, 2 CPU, 1.9 GB RAM + 2 GB swap, Docker from Ubuntu repos (docker.io, docker-compose-v2).
- Stack `docker-compose.prod.yml`: postgres, backend (tsx at runtime, `prisma migrate deploy` on start), frontend (vite build → nginx, SPA fallback), caddy (auto Let's Encrypt; `/api/*` + `/ws` → backend:4000, else frontend; www → apex redirect). Caddyfile: `deploy/Caddyfile`.
- Server dir `/opt/troyka`; secrets only in `/opt/troyka/.env` (POSTGRES_PASSWORD, DOMAIN) — excluded from rsync, never committed.
- CI/CD `.github/workflows/deploy.yml`: push to main → npm test + backend tsc + frontend build → rsync to /opt/troyka → `docker compose -f docker-compose.prod.yml up -d --build`. PRs: checks only. GitHub secrets: DEPLOY_HOST, DEPLOY_USER (root), DEPLOY_SSH_KEY.
- SSH from the dev Mac: `ssh -i ~/.ssh/troyka_deploy root@195.216.169.108` (never use the root password).
- Backend Docker image uses full `node:20-bookworm` (has openssl) — no apt-get, Debian mirrors were unreachable from the dev network.
- Frontend backend URLs are baked at build time via VITE_BACKEND_HTTP_URL / VITE_BACKEND_WS_URL build args (https://$DOMAIN, wss://$DOMAIN/ws).
- Prod DB is separate from local dev DB.
