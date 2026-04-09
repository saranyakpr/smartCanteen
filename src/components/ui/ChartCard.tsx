'use client';

import { Box, Typography } from '@mui/material';

import { SectionCard } from './SectionCard';

export function ChartCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title}>
      <Box role="img" aria-label={summary}>
        {children}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {summary}
      </Typography>
    </SectionCard>
  );
}

