/**
 * In-memory failed-attempt limiter (single backend process). Keyed per client IP + email so one
 * attacker can't lock a real user out from elsewhere; resets on success or after the window.
 */
export class AttemptLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.resetAt <= Date.now()) {
      this.attempts.delete(key);
      return false;
    }
    return entry.count >= this.maxAttempts;
  }

  recordFailure(key: string) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    else entry.count += 1;

    if (this.attempts.size > 10_000) {
      for (const [k, v] of this.attempts) if (v.resetAt <= now) this.attempts.delete(k);
    }
  }

  reset(key: string) {
    this.attempts.delete(key);
  }
}
