import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminRoute from '@/components/AdminRoute';

const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

function renderWithRouter(initialEntry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin" element={<AdminRoute><div data-testid="admin-content">Admin Panel</div></AdminRoute>} />
        <Route path="/" element={<div data-testid="home-content">Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a / si getUser lanza error (catch path)', async () => {
    mockGetUser.mockRejectedValue(new Error('Network error'));
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('home-content')).toBeDefined();
    });
  });

  it('renderiza children si el usuario es admin', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          app_metadata: { role: 'admin' },
        },
      },
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeDefined();
    });
  });

  it('redirige a / si el usuario NO es admin', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          app_metadata: { role: 'user' },
        },
      },
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('home-content')).toBeDefined();
    });
  });

  it('redirige a / si no hay usuario autenticado', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('home-content')).toBeDefined();
    });
  });

  it('redirige a / si app_metadata no tiene role', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          app_metadata: {},
        },
      },
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('home-content')).toBeDefined();
    });
  });
});
