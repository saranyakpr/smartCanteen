'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent>
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
            {label}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {value}
          </Typography>
          {helper ? (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

