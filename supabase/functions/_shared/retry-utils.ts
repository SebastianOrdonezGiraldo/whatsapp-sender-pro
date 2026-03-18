// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

/**
 * Calculates exponential backoff delay in milliseconds.
 * retryCount=0 -> baseMs, retryCount=1 -> baseMs*2, etc.
 * Always capped at maxMs.
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseMs: number,
  maxMs: number
): number {
  const safeRetryCount = Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0;
  const safeBaseMs = Number.isFinite(baseMs) ? Math.max(0, baseMs) : 0;
  const safeMaxMs = Number.isFinite(maxMs) ? Math.max(0, maxMs) : 0;

  if (safeMaxMs === 0) {
    return 0;
  }

  const delay = safeBaseMs * Math.pow(2, safeRetryCount);
  return Math.min(delay, safeMaxMs);
}

/**
 * Computes next retry timestamp as ISO string from now + backoff delay.
 */
export function computeNextRetryAt(
  nowMs: number,
  retryCount: number,
  baseMs: number,
  maxMs: number
): string {
  const delayMs = calculateBackoffDelay(retryCount, baseMs, maxMs);
  return new Date(nowMs + delayMs).toISOString();
}
