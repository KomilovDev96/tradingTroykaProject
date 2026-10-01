# Tech stack

- TypeScript everywhere, ESM (`"type": "module"`). npm workspaces (`packages/*`, `apps/*`), lockfile `package-lock.json`.
- Engine: TS 5.6, vitest 2.
- Backend: Node 20+, Express 4, ws 8, Prisma 5 + PostgreSQL 16 (docker, host port 5433), tsx for dev.
- Frontend: Vite 8, React 19, TS ~6.0, antd 6, zustand 5, @tanstack/react-query 5, react-router-dom 7, lightweight-charts 5, dayjs, oxlint.
- Market data: Deriv public WebSocket API (no key).
