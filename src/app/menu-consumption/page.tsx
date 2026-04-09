'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
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
import { X } from 'lucide-react';
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
import { FilterBar } from '@/components/ui/FilterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { TableShell } from '@/components/ui/TableShell';
import {
  addDaysISODate,
  getLowAcceptanceSignals,
  getMenuSessionPerformance,
  summarizeMenuItemPerformance,
} from '@/lib/analytics';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate, Session } from '@/types/common';

type RangePreset = 'last7' | 'last14' | 'custom';

const SESSIONS: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];

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

function toSignalChipColor(key: 'Low rating' | 'Repeated leftovers' | 'Repeated waste') {
  switch (key) {
    case 'Repeated waste':
      return 'error' as const;
    case 'Repeated leftovers':
      return 'warning' as const;
    case 'Low rating':
    default:
      return 'warning' as const;
  }
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN');

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function MenuConsumptionPage() {
  const router = useRouter();
  const theme = useTheme();

  const asOfDate = useDashboardStore((s) => s.asOfDate);
  const filters = useDashboardStore((s) => s.filters);
  const setAsOfDate = useDashboardStore((s) => s.setAsOfDate);
  const setFilters = useDashboardStore((s) => s.setFilters);

  const menuItems = useMenuStore((s) => s.menuItems);
  const menuSessions = useMenuStore((s) => s.menuSessions);
  const kitchenPlans = useMenuStore((s) => s.kitchenPlans);
  const upsertKitchenPlan = useMenuStore((s) => s.upsertKitchenPlan);
  const deleteKitchenPlan = useMenuStore((s) => s.deleteKitchenPlan);
  const headcount = useHeadcountStore((s) => s.headcount);
  const wasteEntries = useWasteStore((s) => s.wasteEntries);
  const feedbackEntries = useFeedbackStore((s) => s.feedbackEntries);

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

  const planFromDate = addDaysISODate(asOfDate, 1);
  const planToDate = addDaysISODate(asOfDate, 7);

  const timetableRows = React.useMemo(() => {
    const dates = getDatesInRange(planFromDate, planToDate);
    const byKey = new Map(kitchenPlans.map((p) => [`${p.date}|${p.session}`, p]));
    const rows: Array<{ date: ISODate; session: Session; recordId: string | null }> = [];

    for (const date of dates) {
      for (const session of SESSIONS) {
        const record = byKey.get(`${date}|${session}`) ?? null;
        rows.push({ date, session, recordId: record?.id ?? null });
      }
    }
    return rows;
  }, [kitchenPlans, planFromDate, planToDate]);

  const kitchenPlanById = React.useMemo(() => new Map(kitchenPlans.map((p) => [p.id, p])), [kitchenPlans]);

  const [planEditId, setPlanEditId] = React.useState<string | null>(null);
  const [planFormDate, setPlanFormDate] = React.useState<ISODate>(() => addDaysISODate(asOfDate, 1));
  const [planFormSession, setPlanFormSession] = React.useState<Session>('Lunch');
  const [planFormMenuItemId, setPlanFormMenuItemId] = React.useState<string>(menuItems[0]?.id ?? '');
  const [planFormPlannedQty, setPlanFormPlannedQty] = React.useState('');
  const [planFormNotes, setPlanFormNotes] = React.useState('');

  React.useEffect(() => {
    if (planEditId) return;
    setPlanFormDate(addDaysISODate(asOfDate, 1));
  }, [asOfDate, planEditId]);

  React.useEffect(() => {
    if (menuItems.length === 0) return;
    if (menuItems.some((m) => m.id === planFormMenuItemId)) return;
    setPlanFormMenuItemId(menuItems[0]?.id ?? '');
  }, [menuItems, planFormMenuItemId]);

  React.useEffect(() => {
    if (!planEditId) return;
    const record = kitchenPlanById.get(planEditId) ?? null;
    if (!record) return;
    setPlanFormDate(record.date);
    setPlanFormSession(record.session);
    setPlanFormMenuItemId(record.menuItemId);
    setPlanFormPlannedQty(String(record.plannedQty));
    setPlanFormNotes(record.notes ?? '');
  }, [kitchenPlanById, planEditId]);

  const planFormErrors: string[] = [];
  if (!planFormDate) planFormErrors.push('Date is required.');
  if (!planFormMenuItemId) planFormErrors.push('Menu item is required.');
  if (planFormPlannedQty.trim().length === 0) planFormErrors.push('Planned plates is required.');
  else if (!(Number.isFinite(Number(planFormPlannedQty)) && Number(planFormPlannedQty) > 0))
    planFormErrors.push('Planned plates must be a positive number.');

  const resetPlanForm = () => {
    setPlanEditId(null);
    setPlanFormDate(addDaysISODate(asOfDate, 1));
    setPlanFormSession('Lunch');
    setPlanFormPlannedQty('');
    setPlanFormNotes('');
  };

  const startPlanFor = (date: ISODate, session: Session) => {
    setPlanEditId(null);
    setPlanFormDate(date);
    setPlanFormSession(session);
    setPlanFormPlannedQty('');
    setPlanFormNotes('');
  };

  const sessionPerformance = React.useMemo(
    () =>
      getMenuSessionPerformance({
        menuItems,
        menuSessions,
        headcount,
        wasteEntries,
        feedbackEntries,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        session: filters.session,
      }),
    [
      feedbackEntries,
      filters.fromDate,
      filters.session,
      filters.toDate,
      headcount,
      menuItems,
      menuSessions,
      wasteEntries,
    ],
  );

  const lowAcceptanceSignals = React.useMemo(() => {
    return getLowAcceptanceSignals({
      menuItems,
      menuSessions,
      wasteEntries,
      feedbackEntries,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      session: filters.session,
      minFeedbackCount: 3,
      thresholdAvgSatisfaction: 3,
      leftoverSessionsThreshold: 3,
      wasteSessionsThreshold: 3,
      perSessionLeftoverPctThreshold: 0.1,
      perSessionWastePctThreshold: 0.08,
    }).slice(0, 6);
  }, [feedbackEntries, filters.fromDate, filters.session, filters.toDate, menuItems, menuSessions, wasteEntries]);

  const menuItemSummaries = React.useMemo(
    () =>
      summarizeMenuItemPerformance({
        menuItems,
        menuSessions,
        wasteEntries,
        feedbackEntries,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        session: filters.session,
        perSessionLeftoverPctThreshold: 0.1,
        perSessionWastePctThreshold: 0.08,
      }),
    [feedbackEntries, filters.fromDate, filters.session, filters.toDate, menuItems, menuSessions, wasteEntries],
  );

  const totals = React.useMemo(() => {
    const totalPrepared = sessionPerformance.reduce((sum, r) => sum + r.preparedQty, 0);
    const totalServed = sessionPerformance.reduce((sum, r) => sum + r.servedQty, 0);
    const totalLeftover = sessionPerformance.reduce((sum, r) => sum + r.leftoverQty, 0);
    const totalWaste = sessionPerformance.reduce((sum, r) => sum + r.wasteQty, 0);
    const expectedMembers = sessionPerformance.reduce((sum, r) => sum + r.headcountExpected, 0);
    const actualMembers = sessionPerformance.reduce((sum, r) => sum + r.headcountActual, 0);

    const varianceQty = totalPrepared - totalServed;
    const variancePct = totalPrepared > 0 ? (varianceQty / totalPrepared) * 100 : 0;
    const wastePct = totalPrepared > 0 ? (totalWaste / totalPrepared) * 100 : 0;

    return {
      expectedMembers,
      actualMembers,
      headcountVariance: actualMembers - expectedMembers,
      totalPrepared,
      totalServed,
      totalLeftover,
      totalWaste,
      varianceQty,
      variancePct,
      wastePct,
    };
  }, [sessionPerformance]);

  const dailySeries = React.useMemo(() => {
    const dates = getDatesInRange(filters.fromDate, filters.toDate);
    return dates.map((d) => {
      const rows = sessionPerformance.filter((r) => r.date === d);
      const prepared = rows.reduce((sum, r) => sum + r.preparedQty, 0);
      const served = rows.reduce((sum, r) => sum + r.servedQty, 0);
      const leftover = rows.reduce((sum, r) => sum + r.leftoverQty, 0);
      const waste = rows.reduce((sum, r) => sum + r.wasteQty, 0);
      const leftoverPct = prepared > 0 ? (leftover / prepared) * 100 : 0;
      const wastePct = prepared > 0 ? (waste / prepared) * 100 : 0;
      return {
        isoDate: d,
        leftoverPct,
        wastePct,
        prepared,
        served,
        leftover,
        waste,
      };
    });
  }, [filters.fromDate, filters.toDate, sessionPerformance]);

  const sessionComparison = React.useMemo(() => {
    return SESSIONS.map((session) => {
      const rows = sessionPerformance.filter((r) => r.session === session);
      const prepared = rows.reduce((sum, r) => sum + r.preparedQty, 0);
      const leftover = rows.reduce((sum, r) => sum + r.leftoverQty, 0);
      const waste = rows.reduce((sum, r) => sum + r.wasteQty, 0);
      return {
        session,
        leftoverPct: prepared > 0 ? (leftover / prepared) * 100 : 0,
        wastePct: prepared > 0 ? (waste / prepared) * 100 : 0,
      };
    });
  }, [sessionPerformance]);

  const [activeMenuItemId, setActiveMenuItemId] = React.useState<string | null>(null);
  const activeMenuSummary = React.useMemo(() => {
    if (!activeMenuItemId) return null;
    return menuItemSummaries.find((s) => s.menuItemId === activeMenuItemId) ?? null;
  }, [activeMenuItemId, menuItemSummaries]);

  const activeMenuOccurrences = React.useMemo(() => {
    if (!activeMenuItemId) return [];
    return sessionPerformance.filter((r) => r.menuItemId === activeMenuItemId);
  }, [activeMenuItemId, sessionPerformance]);

  const activeMenuTrend = React.useMemo(() => {
    if (!activeMenuItemId) return [];
    const dates = getDatesInRange(filters.fromDate, filters.toDate);
    const byDate = new Map<ISODate, { served: number; leftover: number; waste: number }>();
    for (const row of activeMenuOccurrences) {
      const current = byDate.get(row.date) ?? { served: 0, leftover: 0, waste: 0 };
      byDate.set(row.date, {
        served: current.served + row.servedQty,
        leftover: current.leftover + row.leftoverQty,
        waste: current.waste + row.wasteQty,
      });
    }
    return dates
      .filter((d) => byDate.has(d))
      .map((d) => ({ isoDate: d, ...byDate.get(d)! }));
  }, [activeMenuItemId, activeMenuOccurrences, filters.fromDate, filters.toDate]);

  const openMenuItemDrawer = (menuItemId: string) => {
    setActiveMenuItemId(menuItemId);
  };

  const closeDrawer = () => setActiveMenuItemId(null);

  const sessionsToShow = filters.session === 'All' ? SESSIONS : [filters.session];

  return (
    <>
      <PageHeader
        title="Menu & Consumption"
        subtitle="Planned menu vs actual served, leftovers, waste, and low-acceptance signals."
      />

      <Stack spacing={2}>
        <FilterBar
          right={
            <Typography variant="caption" color="text.secondary">
              As of: {format(parseISO(asOfDate), 'EEE, dd MMM yyyy')}
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
            <InputLabel id="menu-session-label">Session</InputLabel>
            <Select
              labelId="menu-session-label"
              value={filters.session}
              label="Session"
              onChange={(e) => setFilters({ session: e.target.value as Session | 'All' })}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Breakfast">Breakfast</MenuItem>
              <MenuItem value="Lunch">Lunch</MenuItem>
              <MenuItem value="Dinner 1">Dinner 1</MenuItem>
              <MenuItem value="Dinner 2">Dinner 2</MenuItem>
            </Select>
          </FormControl>
        </FilterBar>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <SectionCard
              title="Kitchen Timetable (Next 7 days)"
              actions={
                <Button size="small" variant="outlined" onClick={() => router.push('/requests')} sx={{ '@media print': { display: 'none' } }}>
                  Go to Requests
                </Button>
              }
            >
              <Stack spacing={2}>
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Plan meals ahead of time
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This timetable drives the menu-based store requests generated in Requests & Issues.
                  </Typography>
                </Alert>

                <TableShell
                  title="Upcoming plan"
                  actions={
                    <Typography variant="caption" color="text.secondary">
                      {format(parseISO(planFromDate), 'MMM d')} → {format(parseISO(planToDate), 'MMM d')}
                    </Typography>
                  }
                >
                  <Table size="small" aria-label="Kitchen timetable table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell>Menu item</TableCell>
                        <TableCell align="right">Planned (plates)</TableCell>
                        <TableCell>Notes</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timetableRows.map((row) => {
                        const record = row.recordId ? kitchenPlanById.get(row.recordId) ?? null : null;
                        const menuName = record ? menuItems.find((m) => m.id === record.menuItemId)?.name ?? record.menuItemId : '—';
                        return (
                          <TableRow key={`${row.date}|${row.session}`} hover selected={record?.id === planEditId}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseISO(row.date), 'EEE, MMM d')}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.session}</TableCell>
                            <TableCell>{menuName}</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {record ? formatNumber(record.plannedQty) : '—'}
                            </TableCell>
                            <TableCell>{record?.notes ?? '—'}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {record ? (
                                <>
                                  <Button size="small" onClick={() => setPlanEditId(record.id)} sx={{ mr: 0.5 }}>
                                    Edit
                                  </Button>
                                  <Button
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      deleteKitchenPlan(record.id);
                                      if (planEditId === record.id) resetPlanForm();
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </>
                              ) : (
                                <Button size="small" onClick={() => startPlanFor(row.date, row.session)}>
                                  Add
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableShell>

                <Divider />

                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {planEditId ? 'Edit timetable entry' : 'Add timetable entry'}
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        label="Date"
                        type="date"
                        value={planFormDate}
                        onChange={(e) => setPlanFormDate(e.target.value as ISODate)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="kitchen-plan-session-label">Session</InputLabel>
                        <Select
                          labelId="kitchen-plan-session-label"
                          label="Session"
                          value={planFormSession}
                          onChange={(e) => setPlanFormSession(e.target.value as Session)}
                        >
                          {SESSIONS.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="kitchen-plan-menu-label">Menu item</InputLabel>
                        <Select
                          labelId="kitchen-plan-menu-label"
                          label="Menu item"
                          value={planFormMenuItemId}
                          onChange={(e) => setPlanFormMenuItemId(e.target.value as string)}
                        >
                          {menuItems.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                              {m.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        label="Planned plates"
                        type="number"
                        value={planFormPlannedQty}
                        onChange={(e) => setPlanFormPlannedQty(e.target.value)}
                        inputProps={{ min: 1, step: 1 }}
                        error={planFormErrors.length > 0}
                        helperText={planFormErrors[0] ?? 'Enter expected plates for this session.'}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        label="Notes (optional)"
                        value={planFormNotes}
                        onChange={(e) => setPlanFormNotes(e.target.value)}
                        multiline
                        minRows={2}
                      />
                    </Grid>
                  </Grid>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Button variant="outlined" onClick={resetPlanForm}>
                      Clear
                    </Button>
                    <Button
                      variant="contained"
                      disabled={planFormErrors.length > 0}
                      onClick={() => {
                        if (planFormErrors.length > 0) return;
                        upsertKitchenPlan({
                          id: planEditId ?? undefined,
                          date: planFormDate,
                          session: planFormSession,
                          menuItemId: planFormMenuItemId,
                          plannedQty: Number(planFormPlannedQty),
                          notes: planFormNotes.trim().length > 0 ? planFormNotes.trim() : undefined,
                        });
                        setPlanEditId(null);
                        setPlanFormPlannedQty('');
                        setPlanFormNotes('');
                      }}
                    >
                      {planEditId ? 'Save Changes' : 'Save Entry'}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard
                  label="Headcount (Expected)"
                  value={formatNumber(totals.expectedMembers)}
                  helper={totals.headcountVariance === 0 ? 'No variance in range' : `Variance: ${totals.headcountVariance > 0 ? '+' : ''}${formatNumber(totals.headcountVariance)}`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard label="Headcount (Actual Served)" value={formatNumber(totals.actualMembers)} helper="Total for selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard label="Prepared Qty" value={formatNumber(totals.totalPrepared)} helper="Total planned production" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard label="Served Qty" value={formatNumber(totals.totalServed)} helper="Actual served quantity" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard
                  label="Leftover Qty"
                  value={formatNumber(totals.totalLeftover)}
                  helper={`Prep vs consumed variance: ${formatPct(totals.variancePct)}`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <MetricCard label="Waste Qty" value={formatNumber(totals.totalWaste)} helper={`Waste rate: ${formatPct(totals.wastePct)}`} />
              </Grid>
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <SectionCard
              title="Planned Menu (Plan vs Actual)"
              actions={
                <Typography variant="caption" color="text.secondary">
                  Click a menu item for drill-down
                </Typography>
              }
            >
              <Stack spacing={2}>
                {sessionsToShow.map((session, idx) => {
                  const rows = sessionPerformance.filter((r) => r.session === session);
                  return (
                    <Box key={session}>
                      <TableShell
                        title={session}
                        actions={
                          <Typography variant="caption" color="text.secondary">
                            {rows.length} sessions
                          </Typography>
                        }
                      >
                        <Table size="small" aria-label={`${session} planned menu`}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>Date</TableCell>
                              <TableCell>Menu Item</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                Headcount (E/A)
                              </TableCell>
                              <TableCell align="right">Prepared</TableCell>
                              <TableCell align="right">Served</TableCell>
                              <TableCell align="right">Leftover</TableCell>
                              <TableCell align="right">Waste</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                Satisfaction
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((r) => {
                              const leftoverPct = r.preparedQty > 0 ? (r.leftoverQty / r.preparedQty) * 100 : 0;
                              const wastePct = r.preparedQty > 0 ? (r.wasteQty / r.preparedQty) * 100 : 0;
                              return (
                                <TableRow key={`${r.date}|${r.session}`} hover>
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {format(parseISO(r.date), 'MMM d')}
                                  </TableCell>
                                  <TableCell>
                                    <Box
                                      component="button"
                                      type="button"
                                      onClick={() => openMenuItemDrawer(r.menuItemId)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: theme.palette.primary.main,
                                        fontWeight: 600,
                                      }}
                                      aria-label={`Open ${r.menuItemName} drill-down`}
                                    >
                                      {r.menuItemName}
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {formatNumber(r.headcountExpected)} / {formatNumber(r.headcountActual)}
                                  </TableCell>
                                  <TableCell align="right">{formatNumber(r.preparedQty)}</TableCell>
                                  <TableCell align="right">{formatNumber(r.servedQty)}</TableCell>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {formatNumber(r.leftoverQty)}{' '}
                                    <Typography component="span" variant="caption" color="text.secondary">
                                      ({formatPct(leftoverPct)})
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {formatNumber(r.wasteQty)}{' '}
                                    <Typography component="span" variant="caption" color="text.secondary">
                                      ({formatPct(wastePct)})
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    {r.avgSatisfaction === null ? (
                                      <Typography variant="caption" color="text.secondary">
                                        —
                                      </Typography>
                                    ) : (
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {r.avgSatisfaction.toFixed(1)}
                                      </Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableShell>
                      {idx < sessionsToShow.length - 1 ? <Divider sx={{ my: 2 }} /> : null}
                    </Box>
                  );
                })}
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <SectionCard title="Low-Acceptance Signals">
                {lowAcceptanceSignals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No low-acceptance signals found for the selected range.
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {lowAcceptanceSignals.map((s) => (
                      <ListItemButton
                        key={s.menuItemId}
                        onClick={() => openMenuItemDrawer(s.menuItemId)}
                        sx={{ borderRadius: 2, mb: 0.5 }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {s.menuItemName}
                              </Typography>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                {s.signals.map((sig) => (
                                  <StatusChip key={sig.key} label={sig.key} color={toSignalChipColor(sig.key)} />
                                ))}
                              </Stack>
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {s.signals.map((sig) => sig.detail).join(' • ')}
                            </Typography>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </SectionCard>

              <ChartCard
                title="Session Comparison"
                summary={`Leftover and waste rates by session from ${format(parseISO(filters.fromDate), 'MMM d')} to ${format(parseISO(filters.toDate), 'MMM d')}.`}
              >
                <Box sx={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionComparison} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
                      <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                      <XAxis dataKey="session" tickLine={false} axisLine={{ stroke: theme.palette.divider }} />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: theme.palette.divider }}
                        width={42}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value ?? 0).toFixed(1)}%`,
                          name === 'leftoverPct' ? 'Leftover' : 'Waste',
                        ]}
                      />
                      <Bar dataKey="leftoverPct" fill={theme.palette.primary.light} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="wastePct" fill={theme.palette.warning.main} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </ChartCard>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ChartCard
              title="Menu Performance Trend"
              summary="Daily leftover and waste rates across the selected range."
            >
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                    <XAxis
                      dataKey="isoDate"
                      tickFormatter={(value) => format(parseISO(String(value)), 'MMM d')}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                      width={42}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value ?? 0).toFixed(1)}%`,
                        name === 'leftoverPct' ? 'Leftover' : 'Waste',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="leftoverPct"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wastePct"
                      stroke={theme.palette.warning.main}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Grid>
        </Grid>

        <Drawer
          anchor="right"
          open={Boolean(activeMenuItemId)}
          onClose={closeDrawer}
          PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                  {activeMenuSummary?.menuItemName ?? 'Menu Item'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filters.fromDate} to {filters.toDate} • {filters.session === 'All' ? 'All sessions' : filters.session}
                </Typography>
              </Box>
              <IconButton aria-label="Close" onClick={closeDrawer}>
                <X size={18} />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ p: 2 }}>
            {activeMenuSummary ? (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <MetricCard label="Served Qty" value={formatNumber(activeMenuSummary.totalServedQty)} helper={`${activeMenuSummary.sessionsCount} sessions`} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <MetricCard label="Leftover %" value={formatPct(activeMenuSummary.leftoverPct)} helper={`Waste %: ${formatPct(activeMenuSummary.wastePct)}`} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <MetricCard label="Avg Satisfaction" value={activeMenuSummary.avgSatisfaction === null ? '—' : activeMenuSummary.avgSatisfaction.toFixed(1)} helper={activeMenuSummary.feedbackCount === 0 ? 'No feedback in range' : `n=${activeMenuSummary.feedbackCount}`} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <MetricCard label="Waste Qty" value={formatNumber(activeMenuSummary.totalWasteQty)} helper="Waste linked to sessions" />
                  </Grid>
                </Grid>

                <SectionCard title="Trend (Served vs Leftover vs Waste)">
                  {activeMenuTrend.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No occurrences in the selected range.
                    </Typography>
                  ) : (
                    <Box sx={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activeMenuTrend} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
                          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                          <XAxis
                            dataKey="isoDate"
                            tickFormatter={(value) => format(parseISO(String(value)), 'MMM d')}
                            tickLine={false}
                            axisLine={{ stroke: theme.palette.divider }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={{ stroke: theme.palette.divider }}
                            width={38}
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              `${value ?? 0} plates`,
                              name === 'served' ? 'Served' : name === 'leftover' ? 'Leftover' : 'Waste',
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="served"
                            stroke={theme.palette.primary.main}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="leftover"
                            stroke={theme.palette.info.main}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="waste"
                            stroke={theme.palette.warning.main}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </SectionCard>

                <SectionCard
                  title="Occurrences"
                  actions={
                    <Typography variant="caption" color="text.secondary">
                      {activeMenuOccurrences.length} records
                    </Typography>
                  }
                >
                  <Table size="small" aria-label="Menu item occurrences">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          Headcount (A)
                        </TableCell>
                        <TableCell align="right">Served</TableCell>
                        <TableCell align="right">Leftover</TableCell>
                        <TableCell align="right">Waste</TableCell>
                        <TableCell align="right">Sat.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeMenuOccurrences.map((r) => (
                        <TableRow key={`${r.date}|${r.session}`}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseISO(r.date), 'MMM d')}</TableCell>
                          <TableCell>{r.session}</TableCell>
                          <TableCell align="right">{formatNumber(r.headcountActual)}</TableCell>
                          <TableCell align="right">{formatNumber(r.servedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.leftoverQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.wasteQty)}</TableCell>
                          <TableCell align="right">
                            {r.avgSatisfaction === null ? (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {r.avgSatisfaction.toFixed(1)}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Box
                      component="button"
                      type="button"
                      onClick={() => {
                        if (!activeMenuItemId) return;
                        router.push(`/feedback?menuItemId=${encodeURIComponent(activeMenuItemId)}`);
                      }}
                      style={{
                        background: 'none',
                        border: `1px solid ${theme.palette.divider}`,
                        padding: '8px 10px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: theme.palette.text.primary,
                      }}
                      aria-label="Open feedback module"
                    >
                      Open Feedback
                    </Box>
                  </Stack>
                </SectionCard>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a menu item to view drill-down details.
              </Typography>
            )}
          </Box>
        </Drawer>
      </Stack>
    </>
  );
}
