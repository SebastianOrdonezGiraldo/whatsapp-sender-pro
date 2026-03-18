import { describe, expect, it } from "vitest";
import { calculateBackoffDelay, computeNextRetryAt } from "../../supabase/functions/_shared/retry-utils";

describe("retry/backoff utils", () => {
  it("calcula backoff exponencial desde baseMs", () => {
    expect(calculateBackoffDelay(0, 1000, 60000)).toBe(1000);
    expect(calculateBackoffDelay(1, 1000, 60000)).toBe(2000);
    expect(calculateBackoffDelay(2, 1000, 60000)).toBe(4000);
    expect(calculateBackoffDelay(3, 1000, 60000)).toBe(8000);
  });

  it("respeta el tope máximo configurado", () => {
    expect(calculateBackoffDelay(6, 1000, 5000)).toBe(5000);
    expect(calculateBackoffDelay(20, 1000, 5000)).toBe(5000);
  });

  it("tolera inputs inválidos sin producir delays negativos", () => {
    expect(calculateBackoffDelay(-1, 1000, 60000)).toBe(1000);
    expect(calculateBackoffDelay(Number.NaN, 1000, 60000)).toBe(1000);
    expect(calculateBackoffDelay(1, -1000, 60000)).toBe(0);
    expect(calculateBackoffDelay(1, 1000, -1)).toBe(0);
  });

  it("calcula next_retry_at en formato ISO consistente con el delay", () => {
    const nowMs = Date.UTC(2026, 2, 18, 15, 0, 0); // 2026-03-18T15:00:00.000Z
    const nextRetryAt = computeNextRetryAt(nowMs, 2, 1000, 60000);
    expect(nextRetryAt).toBe("2026-03-18T15:00:04.000Z");
  });
});
