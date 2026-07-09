import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  calculateDelayPerMessage,
  normalizeRateLimitConfig,
  resolveBatchLimit,
  resolveRequestedMaxMessages,
} from "../../supabase/functions/_shared/process-queue-utils";

describe("process queue utils", () => {
  it("usa valores por defecto cuando la config es null", () => {
    expect(normalizeRateLimitConfig(null)).toEqual(DEFAULT_RATE_LIMIT_CONFIG);
  });

  it("normaliza valores inválidos de rate limit a valores seguros", () => {
    const config = normalizeRateLimitConfig({
      messages_per_second: 0,
      messages_per_minute: -10,
      messages_per_hour: Number.NaN,
      batch_size: 0,
      batch_delay_ms: -1,
      retry_delay_base_ms: -500,
      retry_delay_max_ms: 100,
      error_threshold: 0,
      circuit_break_duration_ms: -50,
    });

    expect(config.messages_per_second).toBe(DEFAULT_RATE_LIMIT_CONFIG.messages_per_second);
    expect(config.messages_per_minute).toBe(DEFAULT_RATE_LIMIT_CONFIG.messages_per_minute);
    expect(config.messages_per_hour).toBe(DEFAULT_RATE_LIMIT_CONFIG.messages_per_hour);
    expect(config.batch_size).toBe(DEFAULT_RATE_LIMIT_CONFIG.batch_size);
    expect(config.batch_delay_ms).toBe(DEFAULT_RATE_LIMIT_CONFIG.batch_delay_ms);
    expect(config.retry_delay_base_ms).toBe(DEFAULT_RATE_LIMIT_CONFIG.retry_delay_base_ms);
    expect(config.retry_delay_max_ms).toBeGreaterThanOrEqual(config.retry_delay_base_ms);
    expect(config.error_threshold).toBe(DEFAULT_RATE_LIMIT_CONFIG.error_threshold);
    expect(config.circuit_break_duration_ms).toBe(DEFAULT_RATE_LIMIT_CONFIG.circuit_break_duration_ms);
  });

  it("calcula delay por mensaje de forma finita y consistente", () => {
    const config = normalizeRateLimitConfig({
      messages_per_second: 100,
      batch_size: 10,
      batch_delay_ms: 250,
    });

    const delay = calculateDelayPerMessage(config);

    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBe(25);
  });

  it("normaliza maxMessages solicitado y evita valores inválidos", () => {
    expect(resolveRequestedMaxMessages(10.9)).toBe(10);
    expect(resolveRequestedMaxMessages(1)).toBe(1);
    expect(resolveRequestedMaxMessages(0)).toBeNull();
    expect(resolveRequestedMaxMessages(-1)).toBeNull();
    expect(resolveRequestedMaxMessages(Number.NaN)).toBeNull();
    expect(resolveRequestedMaxMessages("10")).toBeNull();
  });

  it("resuelve batchLimit respetando el límite solicitado", () => {
    expect(resolveBatchLimit(20, null)).toBe(20);
    expect(resolveBatchLimit(20, 5)).toBe(5);
    expect(resolveBatchLimit(20, 50)).toBe(20);
    expect(resolveBatchLimit(20, 0)).toBe(0);
  });
});
