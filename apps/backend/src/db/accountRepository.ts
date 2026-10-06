import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from './prisma';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccountDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  analysisPaused: boolean;
}

export interface AdminAccountDTO extends AccountDTO {
  createdAt: number;
  lastLoginAt: number | null;
}

const ACCOUNT_SELECT = { id: true, name: true, email: true, phone: true, role: true, analysisPaused: true } as const;
const ADMIN_ACCOUNT_SELECT = { ...ACCOUNT_SELECT, createdAt: true, lastLoginAt: true } as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAdminDTO(a: Prisma.AccountGetPayload<{ select: typeof ADMIN_ACCOUNT_SELECT }>): AdminAccountDTO {
  return { ...a, createdAt: a.createdAt.getTime(), lastLoginAt: a.lastLoginAt?.getTime() ?? null };
}

/** Maps a unique-constraint violation to the field that clashed. */
function uniqueViolation(err: unknown): 'EMAIL_TAKEN' | 'PHONE_TAKEN' | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '');
  return target.includes('phone') ? 'PHONE_TAKEN' : 'EMAIL_TAKEN';
}

export async function createAccount(input: {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role?: Role;
}): Promise<{ ok: true; account: AccountDTO } | { ok: false; error: 'EMAIL_TAKEN' | 'PHONE_TAKEN' }> {
  try {
    return { ok: true, account: await prisma.account.create({ data: input, select: ACCOUNT_SELECT }) };
  } catch (err) {
    const clash = uniqueViolation(err);
    if (clash) return { ok: false, error: clash };
    throw err;
  }
}

export function findAccountByEmail(email: string) {
  return prisma.account.findUnique({ where: { email } });
}

export function findAccountWithPasswordById(id: string) {
  return prisma.account.findUnique({ where: { id }, select: { id: true, passwordHash: true } });
}

/** Sets a new password and signs out every other browser; the session `keepToken` belongs to stays. */
export async function changeOwnPassword(accountId: string, passwordHash: string, keepToken: string | null): Promise<void> {
  await prisma.$transaction([
    prisma.account.update({ where: { id: accountId }, data: { passwordHash } }),
    prisma.authSession.deleteMany({
      where: { accountId, ...(keepToken ? { tokenHash: { not: hashToken(keepToken) } } : {}) },
    }),
  ]);
}

export function findAccountByPhone(phone: string) {
  return prisma.account.findUnique({ where: { phone }, select: { id: true } });
}

export async function touchLastLogin(accountId: string) {
  await prisma.account.update({ where: { id: accountId }, data: { lastLoginAt: new Date() } });
}

export async function setAccountPaused(accountId: string, paused: boolean): Promise<AccountDTO> {
  return prisma.account.update({ where: { id: accountId }, data: { analysisPaused: paused }, select: ACCOUNT_SELECT });
}

/** Accounts that receive a position when a signal is confirmed: everyone who signs in and hasn't paused (the super admin too). */
export async function listAccountIdsForNewPositions(): Promise<string[]> {
  const rows = await prisma.account.findMany({ where: { analysisPaused: false }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Super admins who haven't paused — they used to be observers, so they have no row for a position opened before. */
export async function listActiveSuperAdminIds(): Promise<string[]> {
  const rows = await prisma.account.findMany({ where: { role: 'SUPERADMIN', analysisPaused: false }, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Boot-time: make sure the configured super admin exists and has the role. An existing account
 * keeps its password (it may have been changed since); a new one gets `initialPassword`.
 */
export async function ensureSuperAdmin(email: string, initialPasswordHash: () => Promise<string>): Promise<'created' | 'promoted' | 'ok'> {
  const existing = await prisma.account.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role === 'SUPERADMIN') return 'ok';
    await prisma.account.update({ where: { id: existing.id }, data: { role: 'SUPERADMIN' } });
    return 'promoted';
  }
  await prisma.account.create({
    data: { name: 'Super Admin', email, phone: null, passwordHash: await initialPasswordHash(), role: 'SUPERADMIN' },
  });
  return 'created';
}

// --- sessions -------------------------------------------------------------------------------

/** Creates a session and returns the raw cookie token — only its hash is stored. */
export async function createSession(accountId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({ data: { tokenHash: hashToken(token), accountId, expiresAt } });
  return { token, expiresAt };
}

export async function findAccountBySessionToken(token: string): Promise<AccountDTO | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: { select: ACCOUNT_SELECT } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.account;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// --- super admin ----------------------------------------------------------------------------

export async function listAccounts(): Promise<AdminAccountDTO[]> {
  const rows = await prisma.account.findMany({ select: ADMIN_ACCOUNT_SELECT, orderBy: { createdAt: 'desc' } });
  return rows.map(toAdminDTO);
}

export async function getAccount(id: string): Promise<AdminAccountDTO | null> {
  const row = await prisma.account.findUnique({ where: { id }, select: ADMIN_ACCOUNT_SELECT });
  return row ? toAdminDTO(row) : null;
}

/** A password change also signs that account out everywhere. */
export async function updateAccount(
  id: string,
  data: { name?: string; email?: string; phone?: string; passwordHash?: string; analysisPaused?: boolean },
): Promise<{ ok: true; account: AdminAccountDTO } | { ok: false; error: 'EMAIL_TAKEN' | 'PHONE_TAKEN' | 'NOT_FOUND' }> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({ where: { id }, data, select: ADMIN_ACCOUNT_SELECT });
      if (data.passwordHash) await tx.authSession.deleteMany({ where: { accountId: id } });
      return updated;
    });
    return { ok: true, account: toAdminDTO(row) };
  } catch (err) {
    const clash = uniqueViolation(err);
    if (clash) return { ok: false, error: clash };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return { ok: false, error: 'NOT_FOUND' };
    throw err;
  }
}

/** Removes the account with its sessions and its own trade history (cascade). */
export async function deleteAccount(id: string): Promise<boolean> {
  const { count } = await prisma.account.deleteMany({ where: { id, role: 'USER' } });
  return count > 0;
}

// --- password reset requests ----------------------------------------------------------------

export async function createResetRequest(phone: string): Promise<void> {
  const account = await findAccountByPhone(phone);
  await prisma.passwordResetRequest.create({ data: { phone, accountId: account?.id ?? null } });
}

export async function listResetRequests() {
  const rows = await prisma.passwordResetRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: { account: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    status: r.status,
    createdAt: r.createdAt.getTime(),
    resolvedAt: r.resolvedAt?.getTime() ?? null,
    account: r.account,
  }));
}

export async function resolveResetRequest(id: string): Promise<boolean> {
  const { count } = await prisma.passwordResetRequest.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
  return count > 0;
}
