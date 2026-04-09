'use client';

import * as React from 'react';

import { useSearchParams } from 'next/navigation';

import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TableShell } from '@/components/ui/TableShell';
import { addDaysISODate, getLowRatedMenuItems, isISODateInRange, summarizeFeedbackByMenuItem } from '@/lib/analytics';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRoleStore } from '@/stores/useRoleStore';

import type { ISODate, Session } from '@/types/common';
import type { FeedbackEntry } from '@/types/feedback';
import type { MenuItem as MenuItemType } from '@/types/menu';

type ViewMode = 'kiosk' | 'analytics';
type RangePreset = 'last7' | 'last14' | 'custom';

const SESSIONS: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];
const RATINGS = [1, 2, 3, 4, 5] as const;

function formatISODateLabel(date: ISODate): string {
  return format(parseISO(date), 'EEE, dd MMM yyyy');
}

function formatISODateShort(date: ISODate): string {
  return format(parseISO(date), 'dd MMM');
}

function formatISODateTimeShort(value: string): string {
  return format(parseISO(value), 'dd MMM, HH:mm');
}

function formatAvg(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function getDatesInRange(fromDate: ISODate, toDate: ISODate): ISODate[] {
  if (fromDate > toDate) return [];
  const dates: ISODate[] = [];
  let cursor = fromDate;
  let safety = 0;
  while (cursor <= toDate && safety < 400) {
    dates.push(cursor);
    cursor = addDaysISODate(cursor, 1);
    safety += 1;
  }
  return dates;
}

type DailyTrendPoint = {
  date: ISODate;
  avgSatisfaction: number | null;
  count: number;
};

function buildDailySatisfactionTrend(entries: FeedbackEntry[], fromDate: ISODate, toDate: ISODate): DailyTrendPoint[] {
  const totals = new Map<string, { count: number; sum: number }>();
  for (const entry of entries) {
    if (!isISODateInRange(entry.date, fromDate, toDate)) continue;
    const current = totals.get(entry.date) ?? { count: 0, sum: 0 };
    totals.set(entry.date, { count: current.count + 1, sum: current.sum + entry.satisfactionScore });
  }

  return getDatesInRange(fromDate, toDate).map((date) => {
    const day = totals.get(date);
    if (!day) return { date, avgSatisfaction: null, count: 0 };
    return { date, avgSatisfaction: day.sum / day.count, count: day.count };
  });
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, next: number | null) => {
          if (!next) return;
          onChange(next);
        }}
        aria-label={`${label} rating`}
        sx={{ mt: 0.75, width: '100%' }}
      >
        {RATINGS.map((rating) => (
          <ToggleButton
            key={rating}
            value={rating}
            aria-label={`${label} ${rating}`}
            sx={{
              flex: 1,
              py: 1.25,
              fontWeight: 700,
              borderColor: 'divider',
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                borderColor: 'primary.main',
              },
              '&.Mui-selected:hover': {
                backgroundColor: 'primary.light',
              },
            }}
          >
            {rating}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

function FeedbackPageContent() {
  const searchParams = useSearchParams();
  const theme = useTheme();

  const role = useRoleStore((s) => s.role);
  const analyticsAllowed = role === 'Admin' || role === 'Chef' || role === 'Management';

  const asOfDate = useDashboardStore((s) => s.asOfDate);
  const filters = useDashboardStore((s) => s.filters);
  const setAsOfDate = useDashboardStore((s) => s.setAsOfDate);
  const setFilters = useDashboardStore((s) => s.setFilters);

  const menuItems = useMenuStore((s) => s.menuItems);
  const menuSessions = useMenuStore((s) => s.menuSessions);

  const feedbackEntries = useFeedbackStore((s) => s.feedbackEntries);
  const addFeedbackEntry = useFeedbackStore((s) => s.addFeedbackEntry);

  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const menuItemIdParam = searchParams.get('menuItemId');
  const [analyticsMenuItemId, setAnalyticsMenuItemId] = React.useState<MenuItemType['id'] | 'All'>('All');

  const [mode, setMode] = React.useState<ViewMode>('kiosk');
  React.useEffect(() => {
    if (analyticsAllowed) return;
    setMode('kiosk');
  }, [analyticsAllowed]);

  React.useEffect(() => {
    if (!menuItemIdParam) return;
    const id = menuItemIdParam as MenuItemType['id'];
    if (!menuById.has(id)) return;
    setAnalyticsMenuItemId(id);
    if (analyticsAllowed) setMode('analytics');
  }, [analyticsAllowed, menuById, menuItemIdParam]);

  const preset: RangePreset = React.useMemo(() => {
    const last7From = addDaysISODate(asOfDate, -6);
    const last14From = addDaysISODate(asOfDate, -13);
    if (filters.fromDate === last7From && filters.toDate === asOfDate) return 'last7';
    if (filters.fromDate === last14From && filters.toDate === asOfDate) return 'last14';
    return 'custom';
  }, [asOfDate, filters.fromDate, filters.toDate]);

  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, next: RangePreset | null) => {
    if (!next) return;
    if (next === 'custom') return;
    const nextFrom = addDaysISODate(asOfDate, next === 'last7' ? -6 : -13);
    setFilters({ fromDate: nextFrom, toDate: asOfDate });
  };

  const handleFromDateChange = (value: string) => {
    const fromDate = value as ISODate;
    if (!fromDate) return;
    if (fromDate > filters.toDate) {
      setFilters({ fromDate, toDate: fromDate });
      setAsOfDate(fromDate);
      return;
    }
    setFilters({ fromDate });
  };

  const handleToDateChange = (value: string) => {
    const toDate = value as ISODate;
    if (!toDate) return;
    if (toDate < filters.fromDate) {
      setFilters({ fromDate: toDate, toDate });
      setAsOfDate(toDate);
      return;
    }
    setFilters({ toDate });
    setAsOfDate(toDate);
  };

  const [formDate, setFormDate] = React.useState<ISODate>(asOfDate);
  const [formSession, setFormSession] = React.useState<Session>('Lunch');
  const [formMenuItemId, setFormMenuItemId] = React.useState<MenuItemType['id'] | ''>(menuItems[0]?.id ?? '');
  const [tasteRating, setTasteRating] = React.useState(4);
  const [quantityRating, setQuantityRating] = React.useState(4);
  const [qualityRating, setQualityRating] = React.useState(4);
  const [menuPreference, setMenuPreference] = React.useState(4);
  const [satisfactionScore, setSatisfactionScore] = React.useState(4);
  const [comment, setComment] = React.useState('');

  React.useEffect(() => setFormDate(asOfDate), [asOfDate]);

  React.useEffect(() => {
    if (menuItems.length === 0) {
      if (formMenuItemId !== '') setFormMenuItemId('');
      return;
    }
    if (menuById.has(formMenuItemId)) return;
    setFormMenuItemId(menuItems[0]?.id ?? '');
  }, [formMenuItemId, menuById, menuItems]);

  React.useEffect(() => {
    const planned = menuSessions.find((s) => s.date === formDate && s.session === formSession);
    if (!planned) return;
    if (!menuById.has(planned.menuItemId)) return;
    setFormMenuItemId(planned.menuItemId);
  }, [formDate, formSession, menuById, menuSessions]);

  const plannedMenuName = React.useMemo(() => {
    const planned = menuSessions.find((s) => s.date === formDate && s.session === formSession);
    if (!planned) return null;
    return menuById.get(planned.menuItemId)?.name ?? null;
  }, [formDate, formSession, menuById, menuSessions]);

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const formMenuItem = formMenuItemId ? menuById.get(formMenuItemId) : undefined;
  const formErrors: string[] = [];
  if (!formDate) formErrors.push('Date is required.');
  if (!formSession) formErrors.push('Session is required.');
  if (!formMenuItem) formErrors.push('Menu item is required.');

  const handleSubmit = () => {
    if (formErrors.length > 0) {
      setSnackbar({ open: true, message: 'Please fix the highlighted fields.', severity: 'error' });
      return;
    }

    if (!formMenuItemId) return;
    addFeedbackEntry({
      date: formDate,
      session: formSession,
      menuItemId: formMenuItemId,
      tasteRating,
      quantityRating,
      qualityRating,
      menuPreference,
      satisfactionScore,
      comment: comment.trim().length > 0 ? comment.trim() : undefined,
      source: 'Kiosk',
    });
    setSnackbar({ open: true, message: 'Thank you — feedback saved.', severity: 'success' });
    setComment('');
  };

  const filteredFeedback = React.useMemo(() => {
    return feedbackEntries.filter((f) => {
      if (!isISODateInRange(f.date, filters.fromDate, filters.toDate)) return false;
      if (filters.session !== 'All' && f.session !== filters.session) return false;
      if (analyticsMenuItemId !== 'All' && f.menuItemId !== analyticsMenuItemId) return false;
      return true;
    });
  }, [analyticsMenuItemId, feedbackEntries, filters.fromDate, filters.session, filters.toDate]);

  const summaries = React.useMemo(
    () => summarizeFeedbackByMenuItem(filteredFeedback, filters.fromDate, filters.toDate),
    [filteredFeedback, filters.fromDate, filters.toDate],
  );

  const overall = React.useMemo(() => {
    const count = filteredFeedback.length;
    const avgSatisfaction = count === 0 ? 0 : filteredFeedback.reduce((sum, f) => sum + f.satisfactionScore, 0) / count;
    return { count, avgSatisfaction };
  }, [filteredFeedback]);

  const lowRated = React.useMemo(() => {
    return getLowRatedMenuItems(menuItems, summaries, 3, 3);
  }, [menuItems, summaries]);

  const worst = React.useMemo(() => {
    const ranked = summaries
      .slice()
      .filter((s) => s.count >= 3)
      .sort((a, b) => a.avgSatisfaction - b.avgSatisfaction);
    if (ranked.length === 0) return null;
    const top = ranked[0];
    const name = menuById.get(top.menuItemId)?.name ?? top.menuItemId;
    return { name, avg: top.avgSatisfaction, count: top.count };
  }, [menuById, summaries]);

  const trend = React.useMemo(
    () => buildDailySatisfactionTrend(filteredFeedback, filters.fromDate, filters.toDate),
    [filteredFeedback, filters.fromDate, filters.toDate],
  );

  const recentComments = React.useMemo(() => {
    return filteredFeedback
      .filter((f) => (f.comment ?? '').trim().length > 0)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  }, [filteredFeedback]);

  return (
    <Box>
      <PageHeader
        title="Feedback"
        subtitle="Kiosk collection + analytics for chefs and management"
        actions={
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, next: ViewMode | null) => {
              if (!next) return;
              if (next === 'analytics' && !analyticsAllowed) return;
              setMode(next);
            }}
            size="small"
            aria-label="Feedback view mode"
          >
            <ToggleButton value="kiosk" aria-label="Kiosk mode">
              Kiosk
            </ToggleButton>
            <ToggleButton value="analytics" aria-label="Analytics mode" disabled={!analyticsAllowed}>
              Analytics
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {!analyticsAllowed ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Analytics view is available to <strong>Chef</strong>, <strong>Management</strong>, and <strong>Admin</strong> roles.
        </Alert>
      ) : null}

      {mode === 'kiosk' ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <SectionCard title="Kiosk entry">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    size="small"
                    label="Date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value as ISODate)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="feedback-session-label">Session</InputLabel>
                    <Select
                      labelId="feedback-session-label"
                      value={formSession}
                      label="Session"
                      onChange={(e) => setFormSession(e.target.value as Session)}
                    >
                      {SESSIONS.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="feedback-menu-item-label">Menu item</InputLabel>
                    <Select
                      labelId="feedback-menu-item-label"
                      value={formMenuItemId}
                      label="Menu item"
                      onChange={(e) => setFormMenuItemId(e.target.value as MenuItemType['id'])}
                    >
                      {menuItems.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {plannedMenuName ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Planned menu for {formatISODateLabel(formDate)} ({formSession}): <strong>{plannedMenuName}</strong>
                </Typography>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RatingRow label="Taste" value={tasteRating} onChange={setTasteRating} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RatingRow label="Quantity" value={quantityRating} onChange={setQuantityRating} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RatingRow label="Quality" value={qualityRating} onChange={setQualityRating} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RatingRow label="Menu preference" value={menuPreference} onChange={setMenuPreference} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <RatingRow label="Satisfaction score" value={satisfactionScore} onChange={setSatisfactionScore} />
                </Grid>
              </Grid>

              <TextField
                size="small"
                label="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                sx={{ mt: 2 }}
              />

              {formErrors.length > 0 ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Stack spacing={0.5}>
                    {formErrors.map((e) => (
                      <Typography key={e} variant="body2">
                        {e}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}

              <Button variant="contained" onClick={handleSubmit} disabled={formErrors.length > 0} sx={{ mt: 2 }}>
                Submit Feedback
              </Button>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Tip: Switch to Analytics to review low-rated items and comments.
              </Typography>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <SectionCard title="Recent comments">
              {recentComments.length === 0 ? (
                <EmptyState title="No comments in the selected range" description="Try expanding the date range in Analytics mode." />
              ) : (
                <Table size="small" aria-label="Recent feedback comments">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Session</TableCell>
                      <TableCell>Menu item</TableCell>
                      <TableCell align="right">Satisfaction</TableCell>
                      <TableCell>Comment</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentComments.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{formatISODateShort(f.date)}</TableCell>
                        <TableCell>{f.session}</TableCell>
                        <TableCell>{menuById.get(f.menuItemId)?.name ?? f.menuItemId}</TableCell>
                        <TableCell align="right">{f.satisfactionScore}</TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>{f.comment}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </Grid>
        </Grid>
      ) : (
        <Stack spacing={2}>
          <FilterBar
            right={
              <Typography variant="caption" color="text.secondary">
                As of: {formatISODateLabel(asOfDate)}
              </Typography>
            }
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Range
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={preset}
                onChange={handlePresetChange}
                size="small"
                aria-label="Date range preset"
              >
                <ToggleButton value="last7" aria-label="Last 7 days">
                  Last 7
                </ToggleButton>
                <ToggleButton value="last14" aria-label="Last 14 days">
                  Last 14
                </ToggleButton>
                <ToggleButton value="custom" aria-label="Custom range">
                  Custom
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {preset === 'custom' ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <TextField
                  size="small"
                  label="From"
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  size="small"
                  label="To"
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            ) : null}

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="feedback-session-filter-label">Session</InputLabel>
              <Select
                labelId="feedback-session-filter-label"
                value={filters.session}
                label="Session"
                onChange={(e) => setFilters({ session: e.target.value as Session | 'All' })}
              >
                <MenuItem value="All">All</MenuItem>
                {SESSIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="feedback-menu-filter-label">Menu item</InputLabel>
              <Select
                labelId="feedback-menu-filter-label"
                value={analyticsMenuItemId}
                label="Menu item"
                onChange={(e) => setAnalyticsMenuItemId(e.target.value as MenuItemType['id'] | 'All')}
              >
                <MenuItem value="All">All</MenuItem>
                {menuItems.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </FilterBar>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <MetricCard label="Avg satisfaction" value={overall.count === 0 ? '—' : formatAvg(overall.avgSatisfaction)} helper="Across selected range" />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <MetricCard label="Responses" value={String(overall.count)} helper={filters.session === 'All' ? 'All sessions' : `Session: ${filters.session}`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <MetricCard
                    label="Worst item (avg)"
                    value={worst ? `${worst.name} • ${formatAvg(worst.avg)}` : '—'}
                    helper={worst ? `${worst.count} responses` : 'Need more data'}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <MetricCard label="Low-rated items" value={String(lowRated.length)} helper="Avg satisfaction ≤ 3 (min 3 responses)" />
                </Grid>
              </Grid>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard title="Satisfaction trend" summary="Daily average satisfaction score for the selected range">
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                      <XAxis dataKey="date" tickFormatter={(d) => formatISODateShort(d as ISODate)} />
                      <YAxis domain={[1, 5]} tickCount={5} />
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const num = typeof value === 'number' ? value : Number(value);
                          const count = (item as { payload?: { count?: number } } | undefined)?.payload?.count ?? 0;
                          if (!Number.isFinite(num)) return ['—', 'Avg satisfaction'];
                          return [formatAvg(num), `Avg satisfaction (${count} responses)`];
                        }}
                        labelFormatter={(label) => `Date: ${formatISODateLabel(label as ISODate)}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSatisfaction"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </ChartCard>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard title="Low-rated items">
                {lowRated.length === 0 ? (
                  <EmptyState title="No low-rated items" description="Try expanding the date range or switching to all sessions." />
                ) : (
                  <Stack spacing={2}>
                    <Box sx={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lowRated.slice(0, 6)} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                          <XAxis type="number" domain={[1, 5]} />
                          <YAxis
                            type="category"
                            dataKey="menuItemName"
                            width={110}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value) => {
                              const num = typeof value === 'number' ? value : Number(value);
                              if (!Number.isFinite(num)) return ['—', 'Avg satisfaction'];
                              return [formatAvg(num), 'Avg satisfaction'];
                            }}
                          />
                          <Bar dataKey="avgSatisfaction" fill={theme.palette.warning.main} radius={[6, 6, 6, 6]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>

                    <TableShell title="Items">
                      <Table size="small" aria-label="Low-rated menu items">
                        <TableHead>
                          <TableRow>
                            <TableCell>Menu item</TableCell>
                            <TableCell align="right">Avg satisfaction</TableCell>
                            <TableCell align="right">Responses</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lowRated.slice(0, 6).map((row) => (
                            <TableRow key={row.menuItemId}>
                              <TableCell>{row.menuItemName}</TableCell>
                              <TableCell align="right">{formatAvg(row.avgSatisfaction)}</TableCell>
                              <TableCell align="right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableShell>
                  </Stack>
                )}
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <SectionCard title="Recent comments">
                {recentComments.length === 0 ? (
                  <EmptyState title="No comments in the selected range" description="Collect kiosk feedback with optional comments to see them here." />
                ) : (
                  <Table size="small" aria-label="Recent feedback comments">
                    <TableHead>
                      <TableRow>
                        <TableCell>When</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell>Menu item</TableCell>
                        <TableCell align="right">Satisfaction</TableCell>
                        <TableCell>Comment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentComments.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>{formatISODateTimeShort(f.createdAt)}</TableCell>
                          <TableCell>{f.session}</TableCell>
                          <TableCell>{menuById.get(f.menuItemId)?.name ?? f.menuItemId}</TableCell>
                          <TableCell align="right">{f.satisfactionScore}</TableCell>
                          <TableCell sx={{ maxWidth: 520 }}>{f.comment}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>
            </Grid>
          </Grid>
        </Stack>
      )}

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
    </Box>
  );
}

export default function FeedbackPage() {
  return (
    <React.Suspense fallback={null}>
      <FeedbackPageContent />
    </React.Suspense>
  );
}
