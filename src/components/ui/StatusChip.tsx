'use client';

import { Chip } from '@mui/material';

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export function StatusChip({
  label,
  color = 'default',
}: {
  label: string;
  color?: ChipColor;
}) {
  return <Chip label={label} color={color} size="small" variant={color === 'default' ? 'outlined' : 'filled'} />;
}

