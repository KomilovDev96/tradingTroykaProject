/** Error codes are returned as-is to the frontend, which translates them (ru / uz-Cyrl / uz-Latn). */
export type AuthErrorCode =
  | 'NAME_INVALID'
  | 'EMAIL_INVALID'
  | 'PHONE_INVALID'
  | 'PASSWORD_TOO_SHORT'
  | 'EMAIL_TAKEN'
  | 'PHONE_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

/** Latin letters, optionally separated by single spaces, hyphens or apostrophes (e.g. "Aziz", "O'Neil"). */
const LATIN_NAME = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** "+998 90 123-45-67" → "+998901234567". Returns '' when it isn't a plausible international number. */
export function normalizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  const digits = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
  return /^\d{9,15}$/.test(digits) ? `+${digits}` : '';
}

type Field<T> = { ok: true; value: T } | { ok: false; error: AuthErrorCode };

function checkName(raw: unknown): Field<string> {
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name.length >= 2 && name.length <= 50 && LATIN_NAME.test(name) ? { ok: true, value: name } : { ok: false, error: 'NAME_INVALID' };
}

function checkEmail(raw: unknown): Field<string> {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL.test(email) ? { ok: true, value: email } : { ok: false, error: 'EMAIL_INVALID' };
}

function checkPhone(raw: unknown): Field<string> {
  const phone = normalizePhone(raw);
  return phone ? { ok: true, value: phone } : { ok: false, error: 'PHONE_INVALID' };
}

function checkPassword(raw: unknown): Field<string> {
  const password = typeof raw === 'string' ? raw : '';
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
    ? { ok: true, value: password }
    : { ok: false, error: 'PASSWORD_TOO_SHORT' };
}

export interface AccountInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/** Sign-up and admin "create user": every field is required. */
export function validateRegistration(body: Record<string, unknown>): { ok: true; value: AccountInput } | { ok: false; error: AuthErrorCode } {
  const name = checkName(body.name);
  if (!name.ok) return name;
  const email = checkEmail(body.email);
  if (!email.ok) return email;
  const phone = checkPhone(body.phone);
  if (!phone.ok) return phone;
  const password = checkPassword(body.password);
  if (!password.ok) return password;
  return { ok: true, value: { name: name.value, email: email.value, phone: phone.value, password: password.value } };
}

/** Admin "edit user": only the fields present are validated and changed; an empty password means "keep". */
export function validateAccountUpdate(
  body: Record<string, unknown>,
): { ok: true; value: Partial<AccountInput> & { analysisPaused?: boolean } } | { ok: false; error: AuthErrorCode } {
  const value: Partial<AccountInput> & { analysisPaused?: boolean } = {};
  for (const [key, check] of [
    ['name', checkName],
    ['email', checkEmail],
    ['phone', checkPhone],
  ] as const) {
    if (body[key] === undefined) continue;
    const result = check(body[key]);
    if (!result.ok) return result;
    value[key] = result.value;
  }
  if (typeof body.password === 'string' && body.password !== '') {
    const password = checkPassword(body.password);
    if (!password.ok) return password;
    value.password = password.value;
  }
  if (typeof body.analysisPaused === 'boolean') value.analysisPaused = body.analysisPaused;
  return { ok: true, value };
}
