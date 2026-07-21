import { describe, expect, it } from "vitest";
import {
  buildQueueMessages,
  mapInsertErrorToUserMessage,
  normalizeRows,
} from "../../supabase/functions/_shared/enqueue-utils";

describe("enqueue utils", () => {
  it("normaliza filas, descarta invalidas y elimina duplicados por telefono+guia", () => {
    const { normalizedRows, duplicatesSkipped, invalidRowsSkipped, invalidEmailsSkipped } = normalizeRows([
      {
        phone_e164: "  +57 3001234567  ",
        guide_number: "  ABC123 ",
        recipient_name: "  Ana  ",
        recipient_email: "  ana@example.com  ",
        priority: 1,
      },
      {
        phone_e164: "+573001234567",
        guide_number: "abc123",
        recipient_name: "Ana Duplicada",
        priority: 9,
      },
      {
        phone_e164: "",
        guide_number: "X-1",
        recipient_name: "Sin Telefono",
      },
      {
        phone_e164: "+573001111111",
        guide_number: "   ",
        recipient_name: "Sin Guia",
      },
      {
        phone_e164: "+573001222222",
        guide_number: "G-2",
        recipient_name: "Luis",
        recipient_email: "correo-invalido",
      },
    ]);

    expect(duplicatesSkipped).toBe(1);
    expect(invalidRowsSkipped).toBe(2);
    expect(invalidEmailsSkipped).toBe(1);
    expect(normalizedRows).toHaveLength(2);
    expect(normalizedRows[0]).toEqual({
      phone_e164: "+57 3001234567",
      guide_number: "ABC123",
      recipient_name: "Ana",
      recipient_email: "ana@example.com",
      priority: 1,
    });
    expect(normalizedRows[1]).toEqual({
      phone_e164: "+573001222222",
      guide_number: "G-2",
      recipient_name: "Luis",
      recipient_email: null,
      priority: 5,
    });
  });

  it("construye mensajes con y sin campos opcionales de carrier", () => {
    const rows = [
      {
        phone_e164: "+573001234567",
        guide_number: "1234567890",
        recipient_name: "Cliente 1",
        recipient_email: "cliente@example.com",
        priority: 3,
      },
    ];

    const withCarrier = buildQueueMessages("job-1", rows, "Sender", true);
    const withoutCarrier = buildQueueMessages("job-1", rows, "Sender", false);

    expect(withCarrier).toHaveLength(1);
    expect(withCarrier[0].status).toBe("PENDING");
    expect(withCarrier[0].carrier).toBe("servientrega");
    expect(withCarrier[0].tracking_url).toContain("1234567890");
    expect(withCarrier[0].recipient_email).toBe("cliente@example.com");
    expect(withCarrier[0].email_status).toBe("PENDING");

    expect(withoutCarrier).toHaveLength(1);
    expect(withoutCarrier[0].status).toBe("PENDING");
    expect(withoutCarrier[0].carrier).toBeUndefined();
    expect(withoutCarrier[0].tracking_url).toBeUndefined();
  });

  it("mapea errores tecnicos de upsert a mensajes accionables", () => {
    expect(
      mapInsertErrorToUserMessage(
        "ON CONFLICT DO UPDATE command cannot affect row a second time"
      )
    ).toContain("filas repetidas");

    expect(
      mapInsertErrorToUserMessage('column "carrier" of relation "message_queue" does not exist')
    ).toContain("base de datos");

    expect(
      mapInsertErrorToUserMessage('column "recipient_email" of relation "message_queue" does not exist')
    ).toContain("base de datos");

    expect(
      mapInsertErrorToUserMessage(
        "there is no unique or exclusion constraint matching the ON CONFLICT specification"
      )
    ).toContain("restricción única");

    expect(mapInsertErrorToUserMessage("random database error")).toContain("No se pudo encolar");
  });
});
