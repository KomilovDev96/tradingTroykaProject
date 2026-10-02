import { BACKEND_HTTP_URL } from './config';

/** Carries the backend's error code (e.g. "EMAIL_TAKEN") so the UI can translate it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(code ?? `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof body.error === 'string' ? body.error : undefined);
  }
  return res.json();
}

export function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, BACKEND_HTTP_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** `credentials: 'include'` sends the httpOnly session cookie (also across ports in local dev). */
export async function getJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  return handle<T>(await fetch(buildUrl(path, params), { credentials: 'include' }));
}

export async function sendJson<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('POST', path, body);
}
