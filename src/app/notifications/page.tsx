'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItemButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { format, parseISO } from 'date-fns';

import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

import type { Severity } from '@/types/common';
import type { NotificationChannel, NotificationItem } from '@/types/notification';

type SnackbarState = { open: boolean; message: string; severity: 'success' | 'info' };

function toSeverityChipColor(severity: NotificationItem['severity']) {
  switch (severity) {
    case 'critical':
      return 'error' as const;
    case 'warning':
      return 'warning' as const;
    case 'info':
    default:
      return 'info' as const;
  }
}

function ChannelStateChips({ item }: { item: NotificationItem }) {
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {item.channels.map((c) => (
        <Chip
          key={`${item.id}:${c.channel}`}
          size="small"
          label={c.active ? c.channel : `${c.channel} (Planned)`}
          variant={c.active ? 'filled' : 'outlined'}
          color={c.active ? 'success' : 'default'}
          sx={c.active ? undefined : { opacity: 0.8 }}
        />
      ))}
    </Stack>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const asOfDate = useDashboardStore((s) => s.asOfDate);

  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const regenerate = useNotificationStore((s) => s.regenerate);

  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [severity, setSeverity] = React.useState<Severity | 'All'>('All');
  const [channel, setChannel] = React.useState<NotificationChannel | 'All'>('All');
  const [module, setModule] = React.useState<NotificationItem['sourceModule'] | 'All'>('All');

  const moduleOptions = React.useMemo(() => {
    const set = new Set<NotificationItem['sourceModule']>();
    for (const n of notifications) set.add(n.sourceModule);
    return Array.from(set.values()).sort();
  }, [notifications]);

  const filtered = React.useMemo(() => {
    return notifications
      .filter((n) => (unreadOnly ? !n.read : true))
      .filter((n) => (severity === 'All' ? true : n.severity === severity))
      .filter((n) => (module === 'All' ? true : n.sourceModule === module))
      .filter((n) => {
        if (channel === 'All') return true;
        return n.channels.some((c) => c.channel === channel);
      })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [channel, module, notifications, severity, unreadOnly]);

  const totals = React.useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.read).length;
    const critical = notifications.filter((n) => n.severity === 'critical').length;
    const warning = notifications.filter((n) => n.severity === 'warning').length;
    return { total, unread, critical, warning };
  }, [notifications]);

  const [snackbar, setSnackbar] = React.useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const handleNotificationClick = (n: NotificationItem) => {
    markRead(n.id);

    if (n.related?.kind === 'StockBatch') {
      router.push(`/stock?batchId=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'StockItem') {
      router.push(`/stock?itemId=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'WasteDate') {
      router.push(`/waste-utilities?date=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'UtilityDate') {
      router.push(`/waste-utilities?date=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'MenuItem') {
      router.push(`/feedback?menuItemId=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'Requests' && n.related.id === 'pending') {
      router.push('/requests?view=pending');
      return;
    }
    if (n.related?.kind === 'Request') {
      router.push(`/requests?requestId=${encodeURIComponent(n.related.id)}`);
      return;
    }
    if (n.related?.kind === 'Recommendations') {
      router.push('/recommendations');
      return;
    }

    switch (n.sourceModule) {
      case 'Stock & Inventory':
        router.push('/stock');
        break;
      case 'Waste & Utilities':
        router.push(`/waste-utilities?date=${encodeURIComponent(asOfDate)}`);
        break;
      case 'Feedback':
        router.push('/feedback');
        break;
      case 'Requests & Issues':
        router.push('/requests');
        break;
      case 'Recommendations':
        router.push('/recommendations');
        break;
      case 'Reports':
        router.push('/reports');
        break;
      case 'Dashboard':
      default:
        router.push('/dashboard');
        break;
    }
  };

  const handleRegenerate = () => {
    regenerate(asOfDate);
    setSnackbar({ open: true, message: 'Notifications regenerated from current demo data.', severity: 'success' });
  };

  const handleMarkAllRead = () => {
    markAllRead();
    setSnackbar({ open: true, message: 'All notifications marked as read.', severity: 'info' });
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="In-app alerts with severity, source module, and channel placeholders."
        actions={
          <Stack direction="row" spacing={1} sx={{ '@media print': { display: 'none' } }}>
            <Button variant="outlined" onClick={handleMarkAllRead} disabled={totals.unread === 0}>
              Mark all read
            </Button>
            <Button variant="contained" onClick={handleRegenerate}>
              Regenerate
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MetricCard label="Total" value={String(totals.total)} helper="All notifications" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MetricCard label="Unread" value={String(totals.unread)} helper="Needs attention" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MetricCard label="Critical" value={String(totals.critical)} helper="Expired batches, etc." />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MetricCard label="Warning" value={String(totals.warning)} helper="Reorder, spikes, thresholds" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Filters">
            <FilterBar>
              <ToggleButtonGroup
                exclusive
                value={unreadOnly ? 'unread' : 'all'}
                onChange={(_, next: 'all' | 'unread' | null) => {
                  if (!next) return;
                  setUnreadOnly(next === 'unread');
                }}
                size="small"
                aria-label="Unread filter"
              >
                <ToggleButton value="all" aria-label="All notifications">
                  All
                </ToggleButton>
                <ToggleButton value="unread" aria-label="Unread only">
                  Unread
                </ToggleButton>
              </ToggleButtonGroup>
            </FilterBar>

            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="notif-severity-label">Severity</InputLabel>
                <Select
                  labelId="notif-severity-label"
                  value={severity}
                  label="Severity"
                  onChange={(e) => setSeverity(e.target.value as Severity | 'All')}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="notif-module-label">Module</InputLabel>
                <Select
                  labelId="notif-module-label"
                  value={module}
                  label="Module"
                  onChange={(e) => setModule(e.target.value as NotificationItem['sourceModule'] | 'All')}
                >
                  <MenuItem value="All">All</MenuItem>
                  {moduleOptions.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="notif-channel-label">Channel</InputLabel>
                <Select
                  labelId="notif-channel-label"
                  value={channel}
                  label="Channel"
                  onChange={(e) => setChannel(e.target.value as NotificationChannel | 'All')}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="In-App">In-App</MenuItem>
                  <MenuItem value="Email">Email</MenuItem>
                  <MenuItem value="SMS">SMS</MenuItem>
                  <MenuItem value="WhatsApp">WhatsApp</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Alert severity="info">
                Only <strong>In-App</strong> is active in the demo. Email/SMS/WhatsApp are placeholders for future integration.
              </Alert>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title={`Notification Center (${filtered.length})`}>
            {filtered.length === 0 ? (
              <EmptyState title="No notifications match the filters" description="Try clearing filters or click Regenerate." />
            ) : (
              <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {filtered.map((n) => (
                  <ListItemButton
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      alignItems: 'flex-start',
                      py: 1.25,
                    }}
                  >
                    <Stack spacing={1} sx={{ width: '100%' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StatusChip label={n.severity.toUpperCase()} color={toSeverityChipColor(n.severity)} />
                        <StatusChip label={n.sourceModule} />
                        {!n.read ? <StatusChip label="UNREAD" color="primary" /> : null}
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {format(parseISO(n.createdAt), 'MMM d, HH:mm')}
                        </Typography>
                      </Stack>

                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: n.read ? 700 : 900 }}>
                          {n.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {n.message}
                        </Typography>
                      </Box>

                      {n.quickActionLabel ? (
                        <Typography variant="caption" color="text.secondary">
                          Quick action: <strong>{n.quickActionLabel}</strong>
                        </Typography>
                      ) : null}

                      <ChannelStateChips item={n} />
                    </Stack>
                  </ListItemButton>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2400}
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
