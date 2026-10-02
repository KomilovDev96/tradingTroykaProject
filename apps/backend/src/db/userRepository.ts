import { prisma } from './prisma';

let cachedUserId: string | null = null;

/**
 * This app has no login flow (out of spec scope) — it's a single-tenant desktop dashboard.
 * We still model User per spec section 39, owning a single default row created on first boot.
 */
export async function getOrCreateDefaultUser(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const existing = await prisma.user.findFirst();
  if (existing) {
    cachedUserId = existing.id;
    return existing.id;
  }

  const created = await prisma.user.create({ data: {} });
  cachedUserId = created.id;
  return created.id;
}
