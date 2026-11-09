/**
 * In-memory fixed-window limiter for FAILED attempts (per Next.js server process).
 * Successful actions are not counted, so many legitimate logins from one shared
 * IP (e.g. a club office) are never blocked. Sufficient for a single web
 * container; use a shared store if the web app is ever scaled horizontally.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** True when the key has reached its failure limit in the current window. */
  isBlocked(key: string): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.limit;
  }

  recordFailure(key: string): void {
    const now = this.now();
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= now) {
      this.failures.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return;
    }
    entry.count += 1;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private prune(now: number) {
    if (this.failures.size < 10_000) return;
    for (const [key, entry] of this.failures) if (entry.resetAt <= now) this.failures.delete(key);
  }
}
