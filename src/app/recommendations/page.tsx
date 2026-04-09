'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Alert, Box, Button, Grid, Snackbar, Stack, Typography } from '@mui/material';
import { format, parseISO } from 'date-fns';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useRecommendationStore } from '@/stores/useRecommendationStore';
import { useStockStore } from '@/stores/useStockStore';

import type { Recommendation, RecommendationSeverity } from '@/types/recommendation';

type SnackbarState = { open: boolean; message: string; severity: 'success' | 'info' };

const SEVERITY_RANK: Record<RecommendationSeverity, number> = { High: 0, Medium: 1, Low: 2 };

function toSeverityChipColor(severity: RecommendationSeverity) {
  switch (severity) {
    case 'High':
      return 'error' as const;
    case 'Medium':
      return 'warning' as const;
    case 'Low':
    default:
      return 'info' as const;
  }
}

function toConfidenceChipColor(confidence: Recommendation['confidence']) {
  switch (confidence) {
    case 'High':
      return 'success' as const;
    case 'Medium':
      return 'warning' as const;
    case 'Low':
    default:
      return 'info' as const;
  }
}

function toModuleRoute(module: Recommendation['impactedModule']): string {
  switch (module) {
    case 'Menu & Consumption':
      return '/menu-consumption';
    case 'Waste & Utilities':
      return '/waste-utilities';
    case 'Stock & Inventory':
      return '/stock';
    case 'Requests & Issues':
      return '/requests';
    case 'Feedback':
      return '/feedback';
    case 'Dashboard':
    default:
      return '/dashboard';
  }
}

function formatISODateLabel(date: string): string {
  return format(parseISO(date), 'EEE, dd MMM yyyy');
}

function buildContextLabel(
  recommendation: Recommendation,
  menuById: Map<string, { name: string }>,
  stockById: Map<string, { name: string }>,
): string {
  const parts: string[] = [];
  if (recommendation.impactedDate) parts.push(format(parseISO(recommendation.impactedDate), 'dd MMM'));
  if (recommendation.impactedSession) parts.push(recommendation.impactedSession);
  if (recommendation.impactedMenuItemId) parts.push(menuById.get(recommendation.impactedMenuItemId)?.name ?? recommendation.impactedMenuItemId);
  if (recommendation.impactedStockItemId) parts.push(stockById.get(recommendation.impactedStockItemId)?.name ?? recommendation.impactedStockItemId);
  return parts.join(' • ');
}

function RecommendationCard({
  recommendation,
  contextLabel,
  onDismiss,
  onOpenModule,
}: {
  recommendation: Recommendation;
  contextLabel: string;
  onDismiss: () => void;
  onOpenModule: () => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
              {recommendation.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {contextLabel || '—'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            <StatusChip label={recommendation.severity} color={toSeverityChipColor(recommendation.severity)} />
            <StatusChip label={`Conf: ${recommendation.confidence}`} color={toConfidenceChipColor(recommendation.confidence)} />
            <StatusChip label={recommendation.impactedModule} />
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {recommendation.rationale}
        </Typography>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
            Suggested action
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {recommendation.suggestedAction}
          </Typography>
        </Box>

        {recommendation.supportingIndicators.length > 0 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {recommendation.supportingIndicators.map((i) => (
              <StatusChip key={`${recommendation.id}:${i.label}`} label={`${i.label}: ${i.value}`} />
            ))}
          </Stack>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
          <Button variant="outlined" size="small" onClick={onOpenModule}>
            Open module
          </Button>
          <Button variant="text" size="small" color="error" onClick={onDismiss}>
            Dismiss
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function RecommendationsPage() {
  const router = useRouter();

  const asOfDate = useDashboardStore((s) => s.asOfDate);
  const menuItems = useMenuStore((s) => s.menuItems);
  const stockItems = useStockStore((s) => s.stockItems);

  const recommendations = useRecommendationStore((s) => s.recommendations);
  const regenerate = useRecommendationStore((s) => s.regenerate);
  const dismiss = useRecommendationStore((s) => s.dismiss);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const stockById = React.useMemo(() => new Map(stockItems.map((i) => [i.id, i])), [stockItems]);

  const sorted = React.useMemo(() => {
    return recommendations
      .slice()
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt));
  }, [recommendations]);

  const highPriority = React.useMemo(() => sorted.filter((r) => r.severity === 'High'), [sorted]);

  const [snackbar, setSnackbar] = React.useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const handleRegenerate = () => {
    regenerate(asOfDate);
    addNotification({
      title: 'Recommendations regenerated',
      severity: 'info',
      sourceModule: 'Recommendations',
      message: `Recommendations refreshed for ${formatISODateLabel(asOfDate)}.`,
      quickActionLabel: 'View recommendations',
      related: { kind: 'Recommendations', id: asOfDate },
    });
    setSnackbar({ open: true, message: `Recommendations regenerated (as of ${formatISODateLabel(asOfDate)}).`, severity: 'success' });
  };

  const handleDismiss = (id: string) => {
    dismiss(id);
    setSnackbar({ open: true, message: 'Recommendation dismissed.', severity: 'info' });
  };

  return (
    <>
      <PageHeader
        title="Recommendations"
        subtitle="Deterministic, rule-based recommendations grounded in waste, headcount variance, feedback, stock, utilities, and events."
        actions={
          <Button variant="contained" onClick={handleRegenerate}>
            Regenerate
          </Button>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        This is a simulation (no LLM calls). If you update waste, feedback, stock, or utilities, click <strong>Regenerate</strong> to refresh recommendations.
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="High Priority">
            {highPriority.length === 0 ? (
              <EmptyState title="No high-priority recommendations" description="Try regenerating after updating demo data." />
            ) : (
              <Stack spacing={1.25} sx={{ mt: 1 }}>
                {highPriority.slice(0, 6).map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    contextLabel={buildContextLabel(rec, menuById, stockById)}
                    onDismiss={() => handleDismiss(rec.id)}
                    onOpenModule={() => router.push(toModuleRoute(rec.impactedModule))}
                  />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title={`All Recommendations (${sorted.length})`}>
            {sorted.length === 0 ? (
              <EmptyState title="No recommendations" description="Click Regenerate to compute recommendations from current demo data." />
            ) : (
              <Stack spacing={1.25} sx={{ mt: 1 }}>
                {sorted.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    contextLabel={buildContextLabel(rec, menuById, stockById)}
                    onDismiss={() => handleDismiss(rec.id)}
                    onOpenModule={() => router.push(toModuleRoute(rec.impactedModule))}
                  />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2600}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
