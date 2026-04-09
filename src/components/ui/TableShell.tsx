'use client';

import { Box, Stack, Typography } from '@mui/material';

export function TableShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {actions ? <Box>{actions}</Box> : null}
      </Stack>
      {children}
    </Box>
  );
}

