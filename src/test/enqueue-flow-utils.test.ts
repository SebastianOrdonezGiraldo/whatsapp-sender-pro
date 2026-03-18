import { describe, expect, it, vi } from "vitest";
import {
  isMissingOptionalQueueColumnsError,
  markJobAsFailedEnqueue,
  upsertQueueWithSchemaFallback,
} from "../../supabase/functions/_shared/enqueue-flow-utils";

describe("enqueue flow utils", () => {
  it("detecta errores de esquema faltante para carrier/tracking_url", () => {
    expect(
      isMissingOptionalQueueColumnsError('column "carrier" of relation "message_queue" does not exist')
    ).toBe(true);
    expect(
      isMissingOptionalQueueColumnsError('column "tracking_url" of relation "message_queue" does not exist')
    ).toBe(true);
    expect(isMissingOptionalQueueColumnsError("other database error")).toBe(false);
    expect(isMissingOptionalQueueColumnsError(null)).toBe(false);
  });

  it("no usa fallback cuando el primer upsert es exitoso", async () => {
    const upsertWithoutCarrier = vi.fn().mockResolvedValue({ error: null });
    const result = await upsertQueueWithSchemaFallback({
      upsertWithCarrier: vi.fn().mockResolvedValue({ error: null }),
      upsertWithoutCarrier,
    });

    expect(result).toEqual({ errorMessage: null, fallbackUsed: false });
    expect(upsertWithoutCarrier).not.toHaveBeenCalled();
  });

  it("usa fallback cuando falla por columna faltante y recupera si el fallback funciona", async () => {
    const result = await upsertQueueWithSchemaFallback({
      upsertWithCarrier: vi.fn().mockResolvedValue({
        error: { message: 'column "carrier" of relation "message_queue" does not exist' },
      }),
      upsertWithoutCarrier: vi.fn().mockResolvedValue({ error: null }),
    });

    expect(result).toEqual({ errorMessage: null, fallbackUsed: true });
  });

  it("retorna error final cuando fallback también falla", async () => {
    const result = await upsertQueueWithSchemaFallback({
      upsertWithCarrier: vi.fn().mockResolvedValue({
        error: { message: 'column "tracking_url" of relation "message_queue" does not exist' },
      }),
      upsertWithoutCarrier: vi.fn().mockResolvedValue({
        error: { message: "duplicate key value violates unique constraint" },
      }),
    });

    expect(result).toEqual({
      errorMessage: "duplicate key value violates unique constraint",
      fallbackUsed: true,
    });
  });

  it("marca FAILED_ENQUEUE y retorna true cuando update de job es exitoso", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const logger = { warn: vi.fn(), error: vi.fn() };

    const result = await markJobAsFailedEnqueue(
      { from: fromMock },
      "job-1",
      "queue_upsert_error:test",
      logger
    );

    expect(result).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(updateMock).toHaveBeenCalledWith({ status: "FAILED_ENQUEUE" });
    expect(eqMock).toHaveBeenCalledWith("id", "job-1");
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("retorna false y no llama la BD cuando no hay jobId", async () => {
    const fromMock = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn() };

    const result = await markJobAsFailedEnqueue(
      { from: fromMock },
      null,
      "missing_rows",
      logger
    );

    expect(result).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
