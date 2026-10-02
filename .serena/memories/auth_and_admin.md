# Accounts, positions, super admin, i18n

- `Account` (login) ≠ `User` (single system owner of TradingSession/Trade.userId). Roles: USER | SUPERADMIN.
- Auth: httpOnly cookie `troyka_session`, `AuthSession` stores SHA-256 of token; scrypt passwords (`src/auth/password.ts`). `requireAuth` on `/api` after `/api/health` + `/api/auth/*`; WS `/ws` checks cookie in `verifyClient`. Error responses are codes (`{ error: 'EMAIL_TAKEN' }`), translated on the frontend (`translateError`).
- Validation shared in `src/auth/validation.ts` (Latin name, email, phone → `+digits`, password ≥ 8); frontend mirrors the regexes in RegisterPage/UserFormModal.
- Per-account positions: signal is global; `createTradesForSignal` inserts one Trade per USER with `analysisPaused=false` (unique `[signalId, accountId]`). Stop loss closes all rows of the signal; manual close only the caller's; engine released when `countOpenTradesForSignal` hits 0 (also immediately if nobody received it). Boot hydrates only from trades with `accountId`.
- Super admin bootstrapped from env `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (`ensureSuperAdmin`, password only on first create). Admin API `src/admin/routes.ts` under `/api/admin/*`; frontend `/admin` (pages/admin + widgets/admin) is a separate layout; SUPERADMIN never gets positions.
- Forgot password: `POST /api/auth/forgot {phone}` → `PasswordResetRequest`, resolved in admin panel. Telegram link: `apps/frontend/src/shared/config/support.ts` (empty until provided).
- i18n: `apps/frontend/src/shared/i18n` — `ru.ts` is the key source, `uzCyrl.ts`/`uzLatn.ts` typed `Dictionary` (missing key = compile error). `useT()`, language in localStorage `troyka.language`. All UI text must go through `t()`.
- Prisma migrate dev refuses non-interactive data-loss migrations: generate SQL with `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` into a new folder; folder timestamps must sort after the previous migration.
