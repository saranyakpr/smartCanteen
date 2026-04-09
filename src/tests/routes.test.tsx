import * as React from 'react';

import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';

import DashboardPage from '@/app/dashboard/page';
import FeedbackPage from '@/app/feedback/page';
import MenuConsumptionPage from '@/app/menu-consumption/page';
import NotificationsPage from '@/app/notifications/page';
import RecommendationsPage from '@/app/recommendations/page';
import ReportsPage from '@/app/reports/page';
import RequestsPage from '@/app/requests/page';
import StockPage from '@/app/stock/page';
import WasteUtilitiesPage from '@/app/waste-utilities/page';
import { theme } from '@/theme/theme';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useRecommendationStore } from '@/stores/useRecommendationStore';
import { useReportsStore } from '@/stores/useReportsStore';
import { useRequestStore } from '@/stores/useRequestStore';
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
  useHeadcountStore.getState().resetToSeed();
  useWasteStore.getState().resetToSeed();
  useUtilitiesStore.getState().resetToSeed();
  useStockStore.getState().resetToSeed();
  useRequestStore.getState().resetToSeed();
  useFeedbackStore.getState().resetToSeed();
  useRecommendationStore.getState().resetToSeed();
  useNotificationStore.getState().resetToSeed();
  useReportsStore.getState().resetToSeed();
});

describe('major routes render', () => {
  test('dashboard route renders', () => {
    renderWithTheme(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('menu consumption route renders', () => {
    renderWithTheme(<MenuConsumptionPage />);
    expect(screen.getByText('Menu & Consumption')).toBeInTheDocument();
  });

  test('waste & utilities route renders', () => {
    renderWithTheme(<WasteUtilitiesPage />);
    expect(screen.getByText('Waste & Utilities')).toBeInTheDocument();
  });

  test('stock route renders', () => {
    renderWithTheme(<StockPage />);
    expect(screen.getByText('Stock & Inventory')).toBeInTheDocument();
  });

  test('requests route renders', () => {
    renderWithTheme(<RequestsPage />);
    expect(screen.getByText('Requests & Issues')).toBeInTheDocument();
  });

  test('feedback route renders', () => {
    renderWithTheme(<FeedbackPage />);
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  test('recommendations route renders', () => {
    renderWithTheme(<RecommendationsPage />);
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  test('reports route renders', () => {
    renderWithTheme(<ReportsPage />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  test('notifications route renders', () => {
    renderWithTheme(<NotificationsPage />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});

