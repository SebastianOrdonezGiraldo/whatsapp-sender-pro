import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import QueueMonitor from "@/components/QueueMonitor";

const {
  rpcMock,
  invokeMock,
  getFunctionHeadersMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  invokeMock: vi.fn(),
  getFunctionHeadersMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/config/security", () => ({
  getFunctionHeaders: getFunctionHeadersMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/error-utils", () => ({
  getEdgeErrorMessage: vi.fn().mockResolvedValue("Error de prueba"),
}));

describe("QueueMonitor edge integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFunctionHeadersMock.mockResolvedValue({
      Authorization: "Bearer test-token",
      "X-API-Key": "test-key",
    });
  });

  it("habilita 'Procesar Cola' cuando no hay pending pero sí retrying", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        pending: 0,
        processing: 0,
        sent: 10,
        failed: 1,
        retrying: 2,
        total: 13,
      },
      error: null,
    });

    render(<QueueMonitor jobId="job-123" autoRefresh={false} autoProcess={false} />);

    const processButton = await screen.findByRole("button", { name: /procesar cola/i });
    expect(processButton).toBeEnabled();
  });

  it("invoca process-message-queue con headers de seguridad al hacer click", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        pending: 1,
        processing: 0,
        sent: 0,
        failed: 0,
        retrying: 0,
        total: 1,
      },
      error: null,
    });

    invokeMock.mockResolvedValueOnce({
      data: { message: "ok" },
      error: null,
    });

    render(<QueueMonitor jobId="job-456" autoRefresh={false} autoProcess={false} />);

    const processButton = await screen.findByRole("button", { name: /procesar cola/i });
    fireEvent.click(processButton);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("process-message-queue", {
        body: { jobId: "job-456" },
        headers: {
          Authorization: "Bearer test-token",
          "X-API-Key": "test-key",
        },
        timeout: 30000,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("auto-procesa en silencio cuando hay pendientes y la cola está idle", async () => {
    rpcMock.mockResolvedValue({
      data: {
        pending: 3,
        processing: 0,
        sent: 0,
        failed: 0,
        retrying: 0,
        total: 3,
      },
      error: null,
    });

    invokeMock.mockResolvedValue({
      data: { message: "ok", continuationScheduled: true },
      error: null,
    });

    render(
      <QueueMonitor
        jobId="job-auto"
        autoRefresh={false}
        autoProcess
        autoProcessInitialDelay={50}
        autoProcessInterval={60_000}
      />
    );

    await screen.findByRole("button", { name: /procesar cola/i });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "process-message-queue",
        expect.objectContaining({
          body: { jobId: "job-auto" },
        })
      );
    });

    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("evita doble invocación por doble click rápido en 'Procesar Cola'", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        pending: 2,
        processing: 0,
        sent: 0,
        failed: 0,
        retrying: 0,
        total: 2,
      },
      error: null,
    });

    let resolveInvoke: ((value: { data: { message: string }; error: null }) => void) | null = null;
    invokeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        })
    );

    render(<QueueMonitor jobId="job-race" autoRefresh={false} autoProcess={false} />);

    const processButton = await screen.findByRole("button", { name: /procesar cola/i });

    fireEvent.click(processButton);
    fireEvent.click(processButton);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    resolveInvoke?.({ data: { message: "ok" }, error: null });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  });
});
