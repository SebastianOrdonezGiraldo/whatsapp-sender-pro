import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreviewPage from "@/pages/Preview";

const {
  navigateMock,
  fromMock,
  invokeMock,
  authGetUserMock,
  getFunctionHeadersMock,
  getEdgeErrorMessageMock,
  getEdgeErrorMessageSyncMock,
  toastSuccessMock,
  toastWarningMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
  authGetUserMock: vi.fn(),
  getFunctionHeadersMock: vi.fn(),
  getEdgeErrorMessageMock: vi.fn(),
  getEdgeErrorMessageSyncMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    auth: {
      getUser: authGetUserMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/config/security", () => ({
  getFunctionHeaders: getFunctionHeadersMock,
}));

vi.mock("@/lib/error-utils", () => ({
  getEdgeErrorMessage: getEdgeErrorMessageMock,
  getEdgeErrorMessageSync: getEdgeErrorMessageSyncMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    warning: toastWarningMock,
    error: toastErrorMock,
  },
}));

function seedPreviewSession() {
  sessionStorage.setItem(
    "wa-preview-data",
    JSON.stringify([
      {
        guideNumber: "G-100",
        recipient: "Cliente Uno",
        phoneRaw: "3001234567",
        phoneE164: "+573001234567",
        phoneValid: true,
      },
    ])
  );
  sessionStorage.setItem("wa-preview-filename", "archivo-prueba.xlsx");
  sessionStorage.setItem("wa-assigned-to", "Operador QA");
}

function setupCommonMocks() {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });

  getFunctionHeadersMock.mockResolvedValue({
    Authorization: "Bearer test-token",
    "X-API-Key": "test-key",
  });

  getEdgeErrorMessageSyncMock.mockReturnValue("Error inesperado");
}

describe("Preview edge integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    setupCommonMocks();
  });

  it("muestra aviso de procesamiento parcial cuando quedan mensajes en cola", async () => {
    seedPreviewSession();

    const sentMessagesInMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const jobsInsertSingleMock = vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null });
    const jobsInsertSelectMock = vi.fn(() => ({ single: jobsInsertSingleMock }));
    const jobsInsertMock = vi.fn(() => ({ select: jobsInsertSelectMock }));

    fromMock.mockImplementation((table: string) => {
      if (table === "sent_messages") {
        return {
          select: vi.fn(() => ({
            in: sentMessagesInMock,
          })),
        };
      }
      if (table === "jobs") {
        return {
          insert: jobsInsertMock,
        };
      }
      throw new Error(`Tabla no esperada en test: ${table}`);
    });

    invokeMock.mockResolvedValue({
      data: {
        processResult: {
          sent: 1,
          failed: 0,
          hasMorePending: true,
          queueStats: { pending: 2, retrying: 0, processing: 0 },
        },
        duplicatesSkipped: 0,
        invalidRowsSkipped: 0,
      },
      error: null,
    });

    render(<PreviewPage />);

    const sendButton = await screen.findByRole("button", { name: /enviar whatsapp/i });
    fireEvent.click(sendButton);

    const confirmButton = await screen.findByRole("button", { name: /^enviar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("enqueue-messages", expect.objectContaining({
        timeout: 20000,
      }));
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        expect.stringContaining("Procesados por ahora"),
        expect.objectContaining({ duration: 7000 })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining("continúa automáticamente"),
      expect.anything()
    );
    expect(navigateMock).toHaveBeenCalledWith("/history/job-1", { state: { fromSend: true } });
    expect(sessionStorage.getItem("wa-preview-data")).toBeNull();
  });

  it("marca FAILED_ENQUEUE y navega con enqueueFailed cuando falla enqueue-messages", async () => {
    seedPreviewSession();

    const sentMessagesInMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const jobsInsertSingleMock = vi.fn().mockResolvedValue({ data: { id: "job-2" }, error: null });
    const jobsInsertSelectMock = vi.fn(() => ({ single: jobsInsertSingleMock }));
    const jobsInsertMock = vi.fn(() => ({ select: jobsInsertSelectMock }));
    const jobsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const jobsUpdateMock = vi.fn(() => ({ eq: jobsUpdateEqMock }));

    fromMock.mockImplementation((table: string) => {
      if (table === "sent_messages") {
        return {
          select: vi.fn(() => ({
            in: sentMessagesInMock,
          })),
        };
      }
      if (table === "jobs") {
        return {
          insert: jobsInsertMock,
          update: jobsUpdateMock,
        };
      }
      throw new Error(`Tabla no esperada en test: ${table}`);
    });

    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "invoke failed" },
    });

    getEdgeErrorMessageMock.mockResolvedValue("Error edge");

    render(<PreviewPage />);

    const sendButton = await screen.findByRole("button", { name: /enviar whatsapp/i });
    fireEvent.click(sendButton);

    const confirmButton = await screen.findByRole("button", { name: /^enviar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(jobsUpdateMock).toHaveBeenCalledWith({ status: "FAILED_ENQUEUE" });
    });

    expect(jobsUpdateEqMock).toHaveBeenCalledWith("id", "job-2");
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("Se marcó como FALLIDO_ENCOLADO"),
      expect.objectContaining({ duration: 8000 })
    );
    expect(navigateMock).toHaveBeenCalledWith("/history/job-2", { state: { enqueueFailed: true } });
    expect(sessionStorage.getItem("wa-preview-filename")).toBeNull();
  });
});
