import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { findAccountBySessionToken, type AccountDTO } from '../db/accountRepository';
import { env } from '../env';

export const SESSION_COOKIE = 'troyka_session';

export function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** httpOnly so page scripts can never read it; Lax blocks cross-site POSTs (CSRF); Secure in production (HTTPS). */
export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/' });
}

/** Works for both Express requests and the raw WebSocket upgrade request. */
export async function authenticate(req: IncomingMessage): Promise<AccountDTO | null> {
  const token = readCookie(req, SESSION_COOKIE);
  return token ? findAccountBySessionToken(token) : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  authenticate(req)
    .then((account) => {
      if (!account) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      res.locals.account = account;
      next();
    })
    .catch(next);
}
