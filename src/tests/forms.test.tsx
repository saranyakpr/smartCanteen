import * as React from 'react';

import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FeedbackPage from '@/app/feedback/page';
import RequestsPage from '@/app/requests/page';
import WasteUtilitiesPage from '@/app/waste-utilities/page';
import { theme } from '@/theme/theme';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

beforeEach(() => {
  localStorage.clear();
  useRoleStore.getState().setRole('Admin');
  useDashboardStore.getState().resetToSeed();
  useMenuStore.getState().resetToSeed();
  useWasteStore.getState().resetToSeed();
  useUtilitiesStore.getState().resetToSeed();
  useStockStore.getState().resetToSeed();
});

describe('key form validation', () => {
  test('requests: Create Request disabled until qty provided', async () => {
    const user = userEvent.setup();
    renderWithTheme(<RequestsPage />);

    const createButton = screen.getByRole('button', { name: /Create Request/i });
    expect(createButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Requested Qty/i), '10');
    expect(createButton).toBeEnabled();
  });

  test('waste: Waste quantity required', async () => {
    const user = userEvent.setup();
    renderWithTheme(<WasteUtilitiesPage />);

    const wasteQty = await screen.findByLabelText('Waste Quantity');
    await user.clear(wasteQty);

    const saveWaste = screen.getByRole('button', { name: /Waste Entry/i });
    expect(saveWaste).toBeDisabled();
  });

  test('utilities: Amount required', async () => {
    const user = userEvent.setup();
    renderWithTheme(<WasteUtilitiesPage />);

    const saveUtility = screen.getByRole('button', { name: /Save Utility Entry/i });
    expect(saveUtility).toBeDisabled();

    await user.type(screen.getByLabelText(/Amount/i), '12');
    expect(saveUtility).toBeEnabled();
  });

  test('feedback: Submit disabled when menu missing', async () => {
    useMenuStore.setState({ menuItems: [] });
    renderWithTheme(<FeedbackPage />);

    const submitButton = screen.getByRole('button', { name: /Submit Feedback/i });
    expect(submitButton).toBeDisabled();
  });
});

