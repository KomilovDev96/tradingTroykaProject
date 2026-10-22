/** `Trade.strategy` values: the 5M scalping Troika and the H1 long-term Troika (PDF guide). */
export const SCALPING_STRATEGY = 'TROYKA';
export const LONG_TERM_STRATEGY = 'TROYKA_H1';
/** Entry/stop/target picked by Claude; positions exist for super admins only. */
export const AI_STRATEGY = 'AI';

export function parseStrategy(value: unknown): string | undefined {
  return value === SCALPING_STRATEGY || value === LONG_TERM_STRATEGY || value === AI_STRATEGY ? value : undefined;
}
