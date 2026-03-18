// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

export interface UpsertResultLike {
  error?: { message?: string | null } | null;
}

export interface QueueUpsertFallbackOps {
  upsertWithCarrier: () => Promise<UpsertResultLike>;
  upsertWithoutCarrier: () => Promise<UpsertResultLike>;
}

export interface QueueUpsertFallbackResult {
  errorMessage: string | null;
  fallbackUsed: boolean;
}

function getErrorMessage(error?: { message?: string | null } | null): string | null {
  const message = error?.message;
  if (!message || typeof message !== "string") {
    return null;
  }
  return message;
}

export function isMissingOptionalQueueColumnsError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage || typeof errorMessage !== "string") {
    return false;
  }

  return (
    errorMessage.includes('column "carrier"') ||
    errorMessage.includes('column "tracking_url"')
  );
}

export async function upsertQueueWithSchemaFallback(
  ops: QueueUpsertFallbackOps
): Promise<QueueUpsertFallbackResult> {
  const firstAttempt = await ops.upsertWithCarrier();
  const firstErrorMessage = getErrorMessage(firstAttempt.error);

  if (!firstErrorMessage) {
    return { errorMessage: null, fallbackUsed: false };
  }

  if (!isMissingOptionalQueueColumnsError(firstErrorMessage)) {
    return { errorMessage: firstErrorMessage, fallbackUsed: false };
  }

  const fallbackAttempt = await ops.upsertWithoutCarrier();
  const fallbackErrorMessage = getErrorMessage(fallbackAttempt.error);

  return {
    errorMessage: fallbackErrorMessage,
    fallbackUsed: true,
  };
}

export async function markJobAsFailedEnqueue(
  supabaseClient: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error?: unknown | null }>;
      };
    };
  },
  jobId: string | null | undefined,
  reason: string,
  logger: { warn: (message: string) => void; error: (...args: unknown[]) => void } = console
): Promise<boolean> {
  if (!jobId) {
    return false;
  }

  const { error } = await supabaseClient
    .from("jobs")
    .update({ status: "FAILED_ENQUEUE" })
    .eq("id", jobId);

  if (error) {
    logger.error(`Failed to mark job ${jobId} as FAILED_ENQUEUE (${reason}):`, error);
    return false;
  }

  logger.warn(`Job ${jobId} marked as FAILED_ENQUEUE (${reason}).`);
  return true;
}
