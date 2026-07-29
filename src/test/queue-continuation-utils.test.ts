import { describe, expect, it, vi } from "vitest";
import {
  canContinueAtDepth,
  decideQueueContinuation,
  resolveContinueDepth,
  triggerProcessQueueContinuation,
} from "../../supabase/functions/_shared/queue-continuation-utils";

describe("queue continuation utils", () => {
  it("continúa de inmediato cuando hay pending/processing/email", () => {
    expect(
      decideQueueContinuation({ pending: 3, processing: 0, retrying: 0 })
    ).toMatchObject({
      shouldContinue: true,
      reason: "immediate_work_remaining",
    });

    expect(
      decideQueueContinuation(
        { pending: 1, processing: 0, retrying: 0 },
        { runtimeBudgetReached: true }
      )
    ).toMatchObject({
      shouldContinue: true,
      reason: "runtime_budget_with_remaining_work",
    });

    expect(
      decideQueueContinuation({
        pending: 0,
        processing: 2,
        retrying: 0,
        email_pending: 0,
      })
    ).toMatchObject({ shouldContinue: true });

    expect(
      decideQueueContinuation({
        pending: 0,
        processing: 0,
        retrying: 0,
        email_pending: 1,
      })
    ).toMatchObject({ shouldContinue: true });
  });

  it("hace polling corto cuando solo quedan reintentos", () => {
    const decision = decideQueueContinuation(
      { pending: 0, processing: 0, retrying: 4 },
      { retryPollMs: 3000 }
    );

    expect(decision.shouldContinue).toBe(true);
    expect(decision.delayMs).toBe(3000);
    expect(decision.reason).toBe("retrying_messages_remaining");
  });

  it("no continúa cuando la cola está vacía", () => {
    expect(
      decideQueueContinuation({
        pending: 0,
        processing: 0,
        retrying: 0,
        email_pending: 0,
        email_processing: 0,
      })
    ).toEqual({
      shouldContinue: false,
      delayMs: 0,
      reason: "queue_drained",
    });
  });

  it("resuelve continueDepth y el tope de profundidad", () => {
    expect(resolveContinueDepth(undefined)).toBe(0);
    expect(resolveContinueDepth(-1)).toBe(0);
    expect(resolveContinueDepth(3.9)).toBe(3);
    expect(canContinueAtDepth(0, 50)).toBe(true);
    expect(canContinueAtDepth(50, 50)).toBe(false);
  });

  it("agenda continuación fire-and-forget con waitUntil", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise);
    const logger = { warn: vi.fn(), error: vi.fn() };

    const result = triggerProcessQueueContinuation({
      supabaseUrl: "https://example.supabase.co",
      authorization: "Bearer token",
      apiKey: "api-key",
      jobId: "job-1",
      continueDepth: 2,
      delayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      waitUntil,
      logger,
    });

    expect(result.scheduled).toBe(true);
    expect(waitUntil).toHaveBeenCalledTimes(1);

    await waitUntil.mock.calls[0][0];

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/process-message-queue",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", continueDepth: 2 }),
      })
    );
  });

  it("no agenda si faltan credenciales", () => {
    const result = triggerProcessQueueContinuation({
      supabaseUrl: "",
      authorization: "",
      apiKey: "",
      jobId: "job-1",
      continueDepth: 0,
    });

    expect(result).toEqual({
      scheduled: false,
      reason: "missing_credentials_or_job",
    });
  });
});
