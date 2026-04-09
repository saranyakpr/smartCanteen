'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export function SectionCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {actions ? <Box>{actions}</Box> : null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}
