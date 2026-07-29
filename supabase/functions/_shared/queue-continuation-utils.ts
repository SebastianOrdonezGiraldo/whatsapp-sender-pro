// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

export interface QueueContinuationStats {
  pending?: number;
  processing?: number;
  retrying?: number;
  email_pending?: number;
  email_processing?: number;
}

export interface QueueContinuationDecision {
  shouldContinue: boolean;
  delayMs: number;
  reason: string;
}

export interface TriggerProcessQueueOptions {
  supabaseUrl: string;
  authorization: string;
  apiKey: string;
  jobId: string;
  continueDepth: number;
  delayMs?: number;
  fetchImpl?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
  logger?: { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

export const DEFAULT_PROCESS_CONTINUE_MAX_DEPTH = 50;
export const DEFAULT_PROCESS_CONTINUE_DELAY_MS = 500;
export const DEFAULT_PROCESS_CONTINUE_RETRY_POLL_MS = 3000;
export const DEFAULT_PROCESS_CONTINUE_MAX_DELAY_MS = 30000;

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

/**
 * Decide whether another process-message-queue invocation should be scheduled.
 * Immediate work (pending/processing/email) continues quickly.
 * Retry-only queues poll with a short delay so due retries are picked up without spinning.
 */
export function decideQueueContinuation(
  stats: QueueContinuationStats | null | undefined,
  options?: {
    runtimeBudgetReached?: boolean;
    maxDelayMs?: number;
    immediateDelayMs?: number;
    retryPollMs?: number;
  }
): QueueContinuationDecision {
  const pending = toNonNegativeInt(stats?.pending);
  const processing = toNonNegativeInt(stats?.processing);
  const retrying = toNonNegativeInt(stats?.retrying);
  const emailPending = toNonNegativeInt(stats?.email_pending);
  const emailProcessing = toNonNegativeInt(stats?.email_processing);

  const immediateDelayMs = toNonNegativeInt(
    options?.immediateDelayMs,
    DEFAULT_PROCESS_CONTINUE_DELAY_MS
  );
  const retryPollMs = toNonNegativeInt(
    options?.retryPollMs,
    DEFAULT_PROCESS_CONTINUE_RETRY_POLL_MS
  );
  const maxDelayMs = toNonNegativeInt(
    options?.maxDelayMs,
    DEFAULT_PROCESS_CONTINUE_MAX_DELAY_MS
  );

  if (pending > 0 || processing > 0 || emailPending > 0 || emailProcessing > 0) {
    return {
      shouldContinue: true,
      delayMs: Math.min(immediateDelayMs, maxDelayMs),
      reason: options?.runtimeBudgetReached
        ? "runtime_budget_with_remaining_work"
        : "immediate_work_remaining",
    };
  }

  if (retrying > 0) {
    return {
      shouldContinue: true,
      delayMs: Math.min(retryPollMs, maxDelayMs),
      reason: "retrying_messages_remaining",
    };
  }

  return {
    shouldContinue: false,
    delayMs: 0,
    reason: "queue_drained",
  };
}

export function resolveContinueDepth(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return 0;
  }
  return Math.floor(raw);
}

export function canContinueAtDepth(
  continueDepth: number,
  maxDepth = DEFAULT_PROCESS_CONTINUE_MAX_DEPTH
): boolean {
  return continueDepth < maxDepth;
}

function resolveWaitUntil(
  explicit?: (promise: Promise<unknown>) => void
): ((promise: Promise<unknown>) => void) | null {
  if (typeof explicit === "function") {
    return explicit;
  }
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    return EdgeRuntime.waitUntil.bind(EdgeRuntime);
  }
  return null;
}

/**
 * Fire-and-forget a follow-up process-message-queue call.
 * Prefers EdgeRuntime.waitUntil so the worker stays alive long enough to dispatch.
 */
export function triggerProcessQueueContinuation(
  options: TriggerProcessQueueOptions
): { scheduled: boolean; reason: string } {
  const {
    supabaseUrl,
    authorization,
    apiKey,
    jobId,
    continueDepth,
    delayMs = 0,
    fetchImpl = fetch,
    logger = console,
  } = options;

  if (!supabaseUrl || !authorization || !apiKey || !jobId) {
    return { scheduled: false, reason: "missing_credentials_or_job" };
  }

  const waitUntil = resolveWaitUntil(options.waitUntil);
  const run = async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const response = await fetchImpl(`${supabaseUrl}/functions/v1/process-message-queue`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId, continueDepth }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      logger.warn(
        `Queue continuation for job ${jobId} returned ${response.status}: ${errBody.slice(0, 300)}`
      );
    }
  };

  const promise = run().catch((error) => {
    logger.error(`Failed to schedule queue continuation for job ${jobId}:`, error);
  });

  if (waitUntil) {
    waitUntil(promise);
  }

  return { scheduled: true, reason: waitUntil ? "wait_until" : "detached_promise" };
}
