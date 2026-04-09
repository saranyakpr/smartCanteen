import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';

import { theme } from '@/theme/theme';

import { PageHeader } from './PageHeader';

test('renders title and subtitle', () => {
  render(
    <ThemeProvider theme={theme}>
      <PageHeader title="Dashboard" subtitle="Operations overview" />
    </ThemeProvider>,
  );

  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByText('Operations overview')).toBeInTheDocument();
});

