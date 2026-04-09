'use client';

import { Box, Stack } from '@mui/material';

export function FilterBar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          {children}
        </Stack>
        {right ? <Box>{right}</Box> : null}
      </Stack>
    </Box>
  );
}

