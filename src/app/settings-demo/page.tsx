'use client';

import { Grid } from '@mui/material';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';

export default function SettingsDemoPage() {
  return (
    <>
      <PageHeader
        title="Demo Settings"
        subtitle="Demo-only controls for resetting seeded state and regenerating recommendations."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Seed Data">
            <EmptyState
              title="Reset not implemented yet"
              description="This will reset the demo state to the default seeded scenarios."
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Simulation Controls">
            <EmptyState
              title="Simulation controls not implemented yet"
              description="This will trigger mock SAP sync, alert refresh, and recommendation regeneration."
            />
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}

