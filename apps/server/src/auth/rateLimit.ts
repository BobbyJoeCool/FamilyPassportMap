import type { Request } from "express";

// In-memory rate limits for sending Email codes (Phase 13). In memory is enough for one server
// process: a restart forgets the counts, which at worst lets someone send a few extra codes.

/** Counts events per key over a sliding time window. */
export class SlidingWindowLimiter {
  private readonly events = new Map<string, number[]>();

  /**
   * @param limit - how many events a key may have within the window.
   * @param windowMs - the window's length in milliseconds.
   */
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Records an event for a key if it's under the limit.
   * @param key - what's being limited (an email address, an IP address).
   * @param now - the current time (for tests).
   * @returns true if allowed (and counted), false if over the limit (not counted).
   */
  allow(key: string, now = Date.now()): boolean {
    // Only events still inside the window count.
    const recent = (this.events.get(key) ?? []).filter((time) => time > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.events.set(key, recent);
      return false;
    }
    recent.push(now);
    this.events.set(key, recent);
    return true;
  }

  /** Forgets every count (for tests). */
  reset(): void {
    this.events.clear();
  }
}

/** At most 3 codes per address per 15 minutes. */
export const codesPerAddress = new SlidingWindowLimiter(3, 15 * 60 * 1000);

/** At most 10 codes per IP address per hour. */
export const codesPerIp = new SlidingWindowLimiter(10, 60 * 60 * 1000);

/** Forgets every rate-limit count (for tests). */
export function resetRateLimits(): void {
  codesPerAddress.reset();
  codesPerIp.reset();
}

/**
 * The visitor's IP address. On Voyager every request arrives through the Cloudflare tunnel, so
 * `req.ip` is the tunnel container for everyone; Cloudflare puts the real address in
 * `CF-Connecting-IP`. The app is only reachable through the tunnel there, so that header can't be
 * forged by going around Cloudflare. Elsewhere (local runs, tests) there's no such header.
 * @param req - the request.
 * @returns the address to rate-limit by.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers["cf-connecting-ip"];
  return (typeof forwarded === "string" && forwarded) || req.ip || "unknown";
}
