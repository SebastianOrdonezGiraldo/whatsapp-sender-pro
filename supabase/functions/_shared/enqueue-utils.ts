// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Shared between Deno edge functions and test environment

import { detectCarrier, getTrackingUrl } from "./carrier-utils.ts";

export interface MessageRow {
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  priority?: number;
}

export interface QueueInsertRow {
  job_id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  sender_name: string;
  priority: number;
  status: "PENDING";
  carrier?: string;
  tracking_url?: string;
}

export function normalizeRows(rows: MessageRow[]): {
  normalizedRows: MessageRow[];
  duplicatesSkipped: number;
  invalidRowsSkipped: number;
} {
  const seen = new Set<string>();
  const normalizedRows: MessageRow[] = [];
  let duplicatesSkipped = 0;
  let invalidRowsSkipped = 0;

  for (const row of rows) {
    const phone = row.phone_e164?.trim();
    const guideNumber = row.guide_number?.trim();
    const recipientName = row.recipient_name?.trim();

    if (!phone || !guideNumber || !recipientName) {
      invalidRowsSkipped++;
      continue;
    }

    const dedupePhoneKey = phone.replaceAll(/\s+/g, "");
    const dedupeGuideKey = guideNumber.replaceAll(/\s+/g, "").toLowerCase();
    const uniqueKey = `${dedupePhoneKey}|${dedupeGuideKey}`;

    if (seen.has(uniqueKey)) {
      duplicatesSkipped++;
      continue;
    }
    seen.add(uniqueKey);

    normalizedRows.push({
      phone_e164: phone,
      guide_number: guideNumber,
      recipient_name: recipientName,
      priority: typeof row.priority === "number" ? row.priority : 5,
    });
  }

  return { normalizedRows, duplicatesSkipped, invalidRowsSkipped };
}

export function buildQueueMessages(
  jobId: string,
  rows: MessageRow[],
  senderName: string,
  includeCarrierFields = true
): QueueInsertRow[] {
  return rows.map((row) => {
    const carrierInfo = detectCarrier(row.guide_number);
    const trackingUrl = getTrackingUrl(row.guide_number, carrierInfo);

    const baseRow: QueueInsertRow = {
      job_id: jobId,
      phone_e164: row.phone_e164,
      guide_number: row.guide_number,
      recipient_name: row.recipient_name,
      sender_name: senderName,
      priority: row.priority || 5,
      status: "PENDING",
    };

    if (!includeCarrierFields) {
      return baseRow;
    }

    return {
      ...baseRow,
      carrier: carrierInfo?.carrier || "servientrega",
      tracking_url: trackingUrl,
    };
  });
}

export function mapInsertErrorToUserMessage(rawError: string): string {
  const error = rawError.toLowerCase();

  if (
    error.includes("on conflict do update command cannot affect row a second time") ||
    error.includes("cannot affect row a second time")
  ) {
    return "El archivo tiene filas repetidas con el mismo teléfono y guía. Corrija duplicados e intente de nuevo.";
  }

  if (error.includes('column "carrier"') || error.includes('column "tracking_url"')) {
    return "La base de datos está desactualizada. Ejecute las migraciones pendientes e intente de nuevo.";
  }

  if (error.includes("no unique or exclusion constraint matching the on conflict specification")) {
    return "Falta la restricción única de la cola en la base de datos. Ejecute las migraciones pendientes e intente de nuevo.";
  }

  return "No se pudo encolar los mensajes. Intente de nuevo.";
}
