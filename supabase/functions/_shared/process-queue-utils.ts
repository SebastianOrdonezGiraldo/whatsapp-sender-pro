// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

export interface RateLimitConfig {
  messages_per_second: number;
  messages_per_minute: number;
  messages_per_hour: number;
  batch_size: number;
  batch_delay_ms: number;
  retry_delay_base_ms: number;
  retry_delay_max_ms: number;
  error_threshold: number;
  circuit_break_duration_ms: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  messages_per_second: 80,
  messages_per_minute: 1000,
  messages_per_hour: 10000,
  batch_size: 20,
  batch_delay_ms: 250,
  retry_delay_base_ms: 1000,
  retry_delay_max_ms: 60000,
  error_threshold: 5,
  circuit_break_duration_ms: 30000,
};

function toPositiveInteger(value: unknown, fallback: number, min = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized >= min ? normalized : fallback;
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

export function normalizeRateLimitConfig(input?: Partial<RateLimitConfig> | null): RateLimitConfig {
  const source = input ?? {};
  const messagesPerSecond = toPositiveInteger(
    source.messages_per_second,
    DEFAULT_RATE_LIMIT_CONFIG.messages_per_second
  );
  const batchSize = toPositiveInteger(source.batch_size, DEFAULT_RATE_LIMIT_CONFIG.batch_size);
  const retryBaseMs = toPositiveInteger(
    source.retry_delay_base_ms,
    DEFAULT_RATE_LIMIT_CONFIG.retry_delay_base_ms
  );

  const retryMaxCandidate = toPositiveInteger(
    source.retry_delay_max_ms,
    DEFAULT_RATE_LIMIT_CONFIG.retry_delay_max_ms
  );
  const retryMaxMs = Math.max(retryBaseMs, retryMaxCandidate);

  return {
    messages_per_second: messagesPerSecond,
    messages_per_minute: toPositiveInteger(
      source.messages_per_minute,
      DEFAULT_RATE_LIMIT_CONFIG.messages_per_minute
    ),
    messages_per_hour: toPositiveInteger(
      source.messages_per_hour,
      DEFAULT_RATE_LIMIT_CONFIG.messages_per_hour
    ),
    batch_size: batchSize,
    batch_delay_ms: toNonNegativeInteger(
      source.batch_delay_ms,
      DEFAULT_RATE_LIMIT_CONFIG.batch_delay_ms
    ),
    retry_delay_base_ms: retryBaseMs,
    retry_delay_max_ms: retryMaxMs,
    error_threshold: toPositiveInteger(
      source.error_threshold,
      DEFAULT_RATE_LIMIT_CONFIG.error_threshold
    ),
    circuit_break_duration_ms: toNonNegativeInteger(
      source.circuit_break_duration_ms,
      DEFAULT_RATE_LIMIT_CONFIG.circuit_break_duration_ms
    ),
  };
}

export function calculateDelayPerMessage(config: Pick<RateLimitConfig, "messages_per_second" | "batch_delay_ms" | "batch_size">): number {
  return Math.max(
    1000 / config.messages_per_second,
    config.batch_delay_ms / config.batch_size
  );
}

export function resolveRequestedMaxMessages(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return Math.floor(raw);
}

export function resolveBatchLimit(batchSize: number, remainingRequestedMessages: number | null): number {
  if (remainingRequestedMessages === null) {
    return batchSize;
  }
  return Math.min(batchSize, remainingRequestedMessages);
}
