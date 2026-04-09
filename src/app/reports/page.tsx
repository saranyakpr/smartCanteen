'use client';

import * as React from 'react';

import {
  Box,
  Button,
  Divider,
  FormControl,
  Grid,
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
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
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
import {
  addDaysISODate,
  getBatchesNearExpiry,
  getExpiredBatches,
  getHeadcountPrepServeWasteMatrixForDate,
  getItemsBelowReorder,
  getRawMaterialsIssuedForDate,
  getUtilityTotalsForDate,
  getWasteBySession,
  isISODateInRange,
  summarizeFeedbackByMenuItem,
} from '@/lib/analytics';
import { buildCsv, downloadCsv, type CsvColumn } from '@/lib/exports/csv';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useReportsStore } from '@/stores/useReportsStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate, Session } from '@/types/common';
import type { ReportDefinition } from '@/types/reports';
import type { StockItem } from '@/types/stock';

const SESSIONS: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];
const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN');

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function formatISODateLabel(date: ISODate): string {
  return format(parseISO(date), 'EEE, dd MMM yyyy');
}

function formatISODateShort(date: ISODate): string {
  return format(parseISO(date), 'dd MMM');
}

function getDatesInRange(fromDate: ISODate, toDate: ISODate): ISODate[] {
  if (fromDate > toDate) return [];
  const dates: ISODate[] = [];
  let cursor = fromDate;
  let safety = 0;
  while (cursor <= toDate && safety < 500) {
    dates.push(cursor);
    cursor = addDaysISODate(cursor, 1);
    safety += 1;
  }
  return dates;
}

function exportRowsAsCsv<Row extends Record<string, string | number | boolean | null | undefined>>(params: {
  filename: string;
  columns: Array<CsvColumn<Row>>;
  rows: Row[];
}) {
  const csv = buildCsv(params.columns, params.rows);
  downloadCsv({ filename: params.filename, csv });
}

function toReportKeyLabel(def: ReportDefinition, selected: boolean) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" sx={{ fontWeight: selected ? 800 : 700 }}>
        {def.title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {def.description}
      </Typography>
    </Stack>
  );
}

function computeWeekStart(date: ISODate): ISODate {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return format(start, 'yyyy-MM-dd') as ISODate;
}

export default function ReportsPage() {
  const theme = useTheme();

  const reportDefinitions = useReportsStore((s) => s.reportDefinitions);
  const selectedReportKey = useReportsStore((s) => s.selectedReportKey);
  const setSelectedReportKey = useReportsStore((s) => s.setSelectedReportKey);
  const filters = useReportsStore((s) => s.filters);
  const setFilters = useReportsStore((s) => s.setFilters);

  const menuItems = useMenuStore((s) => s.menuItems);
  const menuSessions = useMenuStore((s) => s.menuSessions);
  const wasteEntries = useWasteStore((s) => s.wasteEntries);
  const headcount = useHeadcountStore((s) => s.headcount);
  const utilityEntries = useUtilitiesStore((s) => s.utilityEntries);

  const stockItems = useStockStore((s) => s.stockItems);
  const stockBatches = useStockStore((s) => s.stockBatches);
  const stockTransactions = useStockStore((s) => s.stockTransactions);

  const requests = useRequestStore((s) => s.requests);
  const issueEvents = useRequestStore((s) => s.issueEvents);

  const feedbackEntries = useFeedbackStore((s) => s.feedbackEntries);

  const selectedDef = reportDefinitions.find((d) => d.key === selectedReportKey) ?? reportDefinitions[0];
  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const stockById = React.useMemo(() => new Map(stockItems.map((i) => [i.id, i])), [stockItems]);

  const supportsSession = selectedDef?.supportsSessionFilter ?? false;

  const printHeader = (
    <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        {selectedDef?.title ?? 'Report'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Range: {formatISODateLabel(filters.fromDate)} → {formatISODateLabel(filters.toDate)}
        {supportsSession && filters.session !== 'All' ? ` • Session: ${filters.session}` : ''}
      </Typography>
    </Box>
  );

  const printButton = (
    <Button
      variant="outlined"
      onClick={() => window.print()}
      sx={{ '@media print': { display: 'none' } }}
    >
      Print
    </Button>
  );

  const preview = (() => {
    switch (selectedReportKey) {
      case 'daily-waste': {
        type Row = { date: ISODate; session: Session; wasteQty: number; topReason: string };
        const grouped = new Map<string, { date: ISODate; session: Session; wasteQty: number; reasons: Map<string, number> }>();
        for (const w of wasteEntries) {
          if (!isISODateInRange(w.date, filters.fromDate, filters.toDate)) continue;
          if (supportsSession && filters.session !== 'All' && w.session !== filters.session) continue;
          const key = `${w.date}:${w.session}`;
          const current = grouped.get(key) ?? { date: w.date, session: w.session, wasteQty: 0, reasons: new Map<string, number>() };
          current.wasteQty += w.wasteQty;
          current.reasons.set(w.reason, (current.reasons.get(w.reason) ?? 0) + w.wasteQty);
          grouped.set(key, current);
        }

        const rows: Row[] = Array.from(grouped.values())
          .map((g) => {
            const topReason = Array.from(g.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
            return { date: g.date, session: g.session, wasteQty: g.wasteQty, topReason };
          })
          .sort((a, b) => b.date.localeCompare(a.date) || a.session.localeCompare(b.session));

        const totalWaste = rows.reduce((sum, r) => sum + r.wasteQty, 0);
        const uniqueDates = new Set(rows.map((r) => r.date)).size;

        const dailyTotals = Array.from(
          rows.reduce((map, r) => {
            map.set(r.date, (map.get(r.date) ?? 0) + r.wasteQty);
            return map;
          }, new Map<ISODate, number>()),
        )
          .map(([date, wasteQty]) => ({ date, wasteQty }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return (
          <Stack spacing={2}>
            {printHeader}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Total waste" value={`${formatNumber(totalWaste)} plates`} helper="Sum for selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Days covered" value={String(uniqueDates)} helper="Dates with waste entries" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Avg waste/day" value={uniqueDates === 0 ? '—' : `${formatNumber(totalWaste / uniqueDates)} plates`} helper="For dates with entries" />
              </Grid>
            </Grid>

            <ChartCard title="Daily waste totals" summary="Total waste quantity per day for the selected range">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTotals}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis dataKey="date" tickFormatter={(d) => formatISODateShort(d as ISODate)} />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [formatNumber(Number(value)), 'Waste (plates)']}
                      labelFormatter={(label) => `Date: ${formatISODateLabel(label as ISODate)}`}
                    />
                    <Bar dataKey="wasteQty" fill={theme.palette.warning.main} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Waste (by date + session)" actions={supportsSession ? <Typography variant="caption" color="text.secondary">Session filter supported</Typography> : null}>
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `daily-waste_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'date', label: 'Date' },
                          { key: 'session', label: 'Session' },
                          { key: 'wasteQty', label: 'WasteQty(plates)' },
                          { key: 'topReason', label: 'TopReason' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No waste rows in range" description="Adjust the date range or session filter." />
                ) : (
                  <Table size="small" aria-label="Daily waste report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell align="right">Waste (plates)</TableCell>
                        <TableCell>Top reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.date}:${r.session}`}>
                          <TableCell>{formatISODateShort(r.date)}</TableCell>
                          <TableCell>{r.session}</TableCell>
                          <TableCell align="right">{formatNumber(r.wasteQty)}</TableCell>
                          <TableCell>{r.topReason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'weekly-waste': {
        type Row = { weekStart: ISODate; wasteQty: number };
        const byWeek = new Map<ISODate, number>();
        for (const w of wasteEntries) {
          if (!isISODateInRange(w.date, filters.fromDate, filters.toDate)) continue;
          const weekStart = computeWeekStart(w.date);
          byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + w.wasteQty);
        }
        const rows: Row[] = Array.from(byWeek.entries())
          .map(([weekStart, wasteQty]) => ({ weekStart, wasteQty }))
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        const totalWaste = rows.reduce((sum, r) => sum + r.wasteQty, 0);

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Total waste" value={`${formatNumber(totalWaste)} plates`} helper="Sum in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Weeks covered" value={String(rows.length)} helper="Based on Monday week start" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Avg waste/week" value={rows.length === 0 ? '—' : `${formatNumber(totalWaste / rows.length)} plates`} helper="For weeks with data" />
              </Grid>
            </Grid>

            <ChartCard title="Weekly waste trend" summary="Waste totals grouped by week (Monday start)">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis dataKey="weekStart" tickFormatter={(d) => formatISODateShort(d as ISODate)} />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [formatNumber(Number(value)), 'Waste (plates)']}
                      labelFormatter={(label) => `Week start: ${formatISODateLabel(label as ISODate)}`}
                    />
                    <Line type="monotone" dataKey="wasteQty" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Weekly totals">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `weekly-waste_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'weekStart', label: 'WeekStart' },
                          { key: 'wasteQty', label: 'WasteQty(plates)' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No waste data in range" />
                ) : (
                  <Table size="small" aria-label="Weekly waste table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Week start</TableCell>
                        <TableCell align="right">Waste (plates)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.weekStart}>
                          <TableCell>{formatISODateLabel(r.weekStart)}</TableCell>
                          <TableCell align="right">{formatNumber(r.wasteQty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'session-waste': {
        type Row = { session: Session; wasteQty: number };
        const totals = getWasteBySession(wasteEntries, filters.fromDate, filters.toDate);
        const rows: Row[] = SESSIONS.map((s) => ({ session: s, wasteQty: totals[s] }));
        const totalWaste = rows.reduce((sum, r) => sum + r.wasteQty, 0);
        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Total waste" value={`${formatNumber(totalWaste)} plates`} helper="Sum in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Highest waste session" value={rows.slice().sort((a, b) => b.wasteQty - a.wasteQty)[0]?.session ?? '—'} helper="Based on totals" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Avg per session" value={`${formatNumber(totalWaste / 4)} plates`} helper="Breakfast/Lunch/Dinner 1/Dinner 2" />
              </Grid>
            </Grid>

            <ChartCard title="Waste by session" summary="Total waste grouped by session">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis dataKey="session" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Waste (plates)']} />
                    <Bar dataKey="wasteQty" fill={theme.palette.warning.main} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Session totals">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `session-waste_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'session', label: 'Session' },
                          { key: 'wasteQty', label: 'WasteQty(plates)' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                <Table size="small" aria-label="Waste by session table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Session</TableCell>
                      <TableCell align="right">Waste (plates)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.session}>
                        <TableCell>{r.session}</TableCell>
                        <TableCell align="right">{formatNumber(r.wasteQty)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'menu-leftover': {
        type Row = { menuItemId: string; menuItemName: string; sessions: number; preparedQty: number; leftoverQty: number; leftoverPct: string };
        const byItem = new Map<string, { sessions: number; prepared: number; leftover: number }>();
        for (const s of menuSessions) {
          if (!isISODateInRange(s.date, filters.fromDate, filters.toDate)) continue;
          if (supportsSession && filters.session !== 'All' && s.session !== filters.session) continue;
          const current = byItem.get(s.menuItemId) ?? { sessions: 0, prepared: 0, leftover: 0 };
          byItem.set(s.menuItemId, {
            sessions: current.sessions + 1,
            prepared: current.prepared + s.preparedQty,
            leftover: current.leftover + s.leftoverQty,
          });
        }

        const rows: Row[] = Array.from(byItem.entries())
          .map(([menuItemId, t]) => {
            const preparedQty = t.prepared;
            const leftoverQty = t.leftover;
            const pct = preparedQty <= 0 ? '—' : `${((leftoverQty / preparedQty) * 100).toFixed(1)}%`;
            return {
              menuItemId,
              menuItemName: menuById.get(menuItemId)?.name ?? menuItemId,
              sessions: t.sessions,
              preparedQty,
              leftoverQty,
              leftoverPct: pct,
            };
          })
          .sort((a, b) => b.leftoverQty - a.leftoverQty);

        const totalPrepared = rows.reduce((sum, r) => sum + r.preparedQty, 0);
        const totalLeftover = rows.reduce((sum, r) => sum + r.leftoverQty, 0);

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Prepared qty" value={`${formatNumber(totalPrepared)} plates`} helper="Sum in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Leftover qty" value={`${formatNumber(totalLeftover)} plates`} helper="Sum in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Leftover rate" value={totalPrepared <= 0 ? '—' : `${((totalLeftover / totalPrepared) * 100).toFixed(1)}%`} helper="Leftover / prepared" />
              </Grid>
            </Grid>

            <ChartCard title="Top leftovers" summary="Menu items with the highest leftover quantities">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.slice(0, 8)} layout="vertical" margin={{ left: 32 }}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="menuItemName" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Leftover (plates)']} />
                    <Bar dataKey="leftoverQty" fill={theme.palette.warning.main} radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Menu-wise leftovers">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `menu-leftover_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'menuItemName', label: 'MenuItem' },
                          { key: 'sessions', label: 'Sessions' },
                          { key: 'preparedQty', label: 'PreparedQty(plates)' },
                          { key: 'leftoverQty', label: 'LeftoverQty(plates)' },
                          { key: 'leftoverPct', label: 'LeftoverPct' },
                        ],
                        rows: rows.map((r) => ({
                          menuItemName: r.menuItemName,
                          sessions: r.sessions,
                          preparedQty: r.preparedQty,
                          leftoverQty: r.leftoverQty,
                          leftoverPct: r.leftoverPct,
                        })),
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No menu sessions in range" />
                ) : (
                  <Table size="small" aria-label="Menu-wise leftovers table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Menu item</TableCell>
                        <TableCell align="right">Sessions</TableCell>
                        <TableCell align="right">Prepared</TableCell>
                        <TableCell align="right">Leftover</TableCell>
                        <TableCell align="right">Leftover %</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.menuItemId}>
                          <TableCell>{r.menuItemName}</TableCell>
                          <TableCell align="right">{r.sessions}</TableCell>
                          <TableCell align="right">{formatNumber(r.preparedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.leftoverQty)}</TableCell>
                          <TableCell align="right">{r.leftoverPct}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'raw-material-consumption': {
        type Row = { itemName: string; unit: StockItem['unit']; issuedQty: number; transactions: number };
        const dates = getDatesInRange(filters.fromDate, filters.toDate);
        const byItem = new Map<string, { issuedQty: number; transactions: number }>();
        for (const d of dates) {
          const daily = getRawMaterialsIssuedForDate(stockItems, stockTransactions, d);
          for (const row of daily.byItem) {
            const current = byItem.get(row.itemId) ?? { issuedQty: 0, transactions: 0 };
            byItem.set(row.itemId, {
              issuedQty: current.issuedQty + row.issuedQty,
              transactions: current.transactions + 1,
            });
          }
        }

        const rows: Row[] = Array.from(byItem.entries())
          .map(([itemId, t]) => ({
            itemName: stockById.get(itemId)?.name ?? itemId,
            unit: (stockById.get(itemId)?.unit ?? 'kg') as StockItem['unit'],
            issuedQty: t.issuedQty,
            transactions: t.transactions,
          }))
          .sort((a, b) => b.issuedQty - a.issuedQty);

        const totalTransactions = stockTransactions.filter((t) => t.type === 'Issue' && isISODateInRange(t.occurredAt.slice(0, 10) as ISODate, filters.fromDate, filters.toDate)).length;

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Issued items" value={String(rows.length)} helper="Unique raw materials issued" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Issue transactions" value={String(totalTransactions)} helper="Count in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Top issued item" value={rows[0]?.itemName ?? '—'} helper={rows[0] ? `${formatNumber(rows[0].issuedQty)} ${rows[0].unit}` : 'No issues in range'} />
              </Grid>
            </Grid>

            <SectionCard title="Issued raw materials (by item)">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `raw-material-consumption_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'itemName', label: 'Item' },
                          { key: 'unit', label: 'Unit' },
                          { key: 'issuedQty', label: 'IssuedQty' },
                          { key: 'transactions', label: 'DaysWithIssues' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No raw material issues in range" />
                ) : (
                  <Table size="small" aria-label="Raw material consumption table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Issued qty</TableCell>
                        <TableCell align="right">Days with issues</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.itemName}>
                          <TableCell>{r.itemName}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell align="right">{formatNumber(r.issuedQty)}</TableCell>
                          <TableCell align="right">{r.transactions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'monthly-stock-utilisation': {
        type Row = {
          itemName: string;
          unit: StockItem['unit'];
          previousMonthNet: number | null;
          currentMonthNet: number;
          varianceQty: number | null;
          variancePct: number | null;
        };

        const inRangeTx = stockTransactions.filter((t) => {
          const d = t.occurredAt.slice(0, 10) as ISODate;
          if (!isISODateInRange(d, filters.fromDate, filters.toDate)) return false;
          return t.type === 'Issue' || t.type === 'Return';
        });

        const monthKeys = Array.from(new Set(inRangeTx.map((t) => t.occurredAt.slice(0, 7)))).sort();
        const currentMonthKey = monthKeys.at(-1) ?? null;
        const previousMonthKey = monthKeys.length >= 2 ? monthKeys.at(-2)! : null;

        const byItemMonth = new Map<string, Map<string, { issued: number; returned: number }>>();
        for (const tx of inRangeTx) {
          const month = tx.occurredAt.slice(0, 7);
          const itemMap = byItemMonth.get(tx.itemId) ?? new Map<string, { issued: number; returned: number }>();
          const current = itemMap.get(month) ?? { issued: 0, returned: 0 };
          if (tx.type === 'Issue') current.issued += Math.abs(tx.qty);
          if (tx.type === 'Return') current.returned += Math.max(0, tx.qty);
          itemMap.set(month, current);
          byItemMonth.set(tx.itemId, itemMap);
        }

        const rows: Row[] =
          currentMonthKey === null
            ? []
            : stockItems
                .map((item) => {
                  const months = byItemMonth.get(item.id) ?? new Map<string, { issued: number; returned: number }>();
                  const current = months.get(currentMonthKey) ?? { issued: 0, returned: 0 };
                  const currentNet = current.issued - current.returned;

                  const prev =
                    previousMonthKey === null ? null : (months.get(previousMonthKey) ?? { issued: 0, returned: 0 });
                  const prevNet = prev ? prev.issued - prev.returned : null;

                  const varianceQty = prevNet === null ? null : currentNet - prevNet;
                  const variancePct =
                    prevNet === null || prevNet === 0 ? null : (varianceQty as number) / prevNet * 100;

                  return {
                    itemName: item.name,
                    unit: item.unit,
                    previousMonthNet: prevNet,
                    currentMonthNet: currentNet,
                    varianceQty,
                    variancePct,
                  };
                })
                .filter((r) => r.currentMonthNet !== 0 || (r.previousMonthNet ?? 0) !== 0)
                .sort((a, b) => b.currentMonthNet - a.currentMonthNet);

        const currentLabel = currentMonthKey ? format(parseISO(`${currentMonthKey}-01`), 'MMM yyyy') : '—';
        const prevLabel = previousMonthKey ? format(parseISO(`${previousMonthKey}-01`), 'MMM yyyy') : null;

        const totalNet = rows.reduce((sum, r) => sum + r.currentMonthNet, 0);
        const topItem = rows[0]?.itemName ?? '—';

        const chartData = rows.slice(0, 8).map((r) => ({ itemName: r.itemName, netQty: r.currentMonthNet, unit: r.unit }));

        return (
          <Stack spacing={2}>
            {printHeader}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Months covered" value={String(monthKeys.length)} helper={monthKeys.length > 0 ? `Current: ${currentLabel}` : 'No issue/return tx in range'} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Top utilised item" value={topItem} helper={rows[0] ? `${formatNumber(rows[0].currentMonthNet)} ${rows[0].unit} (net)` : ''} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Total net issues" value={rows.length === 0 ? '—' : `${formatNumber(totalNet)}`} helper="Net = issues − returns (mixed units)" />
              </Grid>
            </Grid>

            {rows.length === 0 ? (
              <EmptyState title="No issue/return transactions in range" description="Adjust the date range to include stock issues or returns." />
            ) : (
              <>
                <ChartCard title={`Net issues (top items) — ${currentLabel}`} summary="Current month net issues per item (issues minus returns)">
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                        <XAxis dataKey="itemName" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} />
                        <YAxis />
                        <Tooltip
                          formatter={(value, _name, payload) => [`${formatNumber(Number(value))} ${String(payload.payload.unit)}`, 'Net']}
                          labelFormatter={(label) => `Item: ${String(label)}`}
                        />
                        <Bar dataKey="netQty" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartCard>

                <SectionCard title="Monthly utilisation (net issues)">
                  <TableShell
                    title="Rows"
                    actions={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          exportRowsAsCsv({
                            filename: `monthly-stock-utilisation_${filters.fromDate}_to_${filters.toDate}`,
                            columns: [
                              { key: 'itemName', label: 'Item' },
                              { key: 'unit', label: 'Unit' },
                              { key: 'previousMonthNet', label: prevLabel ? `${prevLabel}Net` : 'PrevMonthNet' },
                              { key: 'currentMonthNet', label: `${currentLabel}Net` },
                              { key: 'varianceQty', label: 'VarianceQty' },
                              { key: 'variancePct', label: 'VariancePct' },
                            ],
                            rows: rows.map((r) => ({
                              itemName: r.itemName,
                              unit: r.unit,
                              previousMonthNet: r.previousMonthNet ?? null,
                              currentMonthNet: r.currentMonthNet,
                              varianceQty: r.varianceQty ?? null,
                              variancePct: r.variancePct ?? null,
                            })),
                          })
                        }
                        sx={{ '@media print': { display: 'none' } }}
                      >
                        Export CSV
                      </Button>
                    }
                  >
                    <Table size="small" aria-label="Monthly stock utilisation table">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>Unit</TableCell>
                          <TableCell align="right">{prevLabel ?? 'Previous month'}</TableCell>
                          <TableCell align="right">{currentLabel}</TableCell>
                          <TableCell align="right">Variance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.itemName}>
                            <TableCell>{r.itemName}</TableCell>
                            <TableCell>{r.unit}</TableCell>
                            <TableCell align="right">{r.previousMonthNet === null ? '—' : formatNumber(r.previousMonthNet)}</TableCell>
                            <TableCell align="right">{formatNumber(r.currentMonthNet)}</TableCell>
                            <TableCell align="right">
                              {r.varianceQty === null ? (
                                '—'
                              ) : (
                                <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.varianceQty > 0 ? '+' : ''}
                                  {formatNumber(r.varianceQty)}
                                  {r.variancePct === null ? '' : ` (${r.variancePct > 0 ? '+' : ''}${r.variancePct.toFixed(1)}%)`}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </SectionCard>
              </>
            )}
          </Stack>
        );
      }

      case 'reorder': {
        const rows = getItemsBelowReorder(stockItems, stockBatches);
        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Items below reorder" value={String(rows.length)} helper="Based on on-hand vs reorder level" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Most urgent" value={rows[0]?.itemName ?? '—'} helper={rows[0] ? `On-hand: ${rows[0].onHandQty} ${rows[0].unit}` : ''} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Suggested action" value={rows.length > 0 ? 'Initiate reorder' : '—'} helper="Raise purchase requests for flagged items" />
              </Grid>
            </Grid>

            <SectionCard title="Reorder items">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `reorder_${filters.toDate}`,
                        columns: [
                          { key: 'itemName', label: 'Item' },
                          { key: 'unit', label: 'Unit' },
                          { key: 'onHandQty', label: 'OnHandQty' },
                          { key: 'reorderLevel', label: 'ReorderLevel' },
                          { key: 'reorderQty', label: 'SuggestedReorderQty' },
                        ],
                        rows: rows.map((r) => ({
                          itemName: r.itemName,
                          unit: r.unit,
                          onHandQty: r.onHandQty,
                          reorderLevel: r.reorderLevel,
                          reorderQty: r.reorderQty,
                        })),
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No items below reorder" />
                ) : (
                  <Table size="small" aria-label="Reorder report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">On-hand</TableCell>
                        <TableCell align="right">Reorder level</TableCell>
                        <TableCell align="right">Suggested reorder</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.itemId}>
                          <TableCell>{r.itemName}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell align="right">{formatNumber(r.onHandQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.reorderLevel)}</TableCell>
                          <TableCell align="right">{formatNumber(r.reorderQty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'expiry': {
        type Row = { status: 'Expired' | 'Near expiry'; itemName: string; batchCode: string; expiryDate: string; days: number; remainingQty: number; unit: string };
        const expired = getExpiredBatches(stockBatches, filters.toDate);
        const nearExpiry = getBatchesNearExpiry(stockBatches, filters.toDate, 5);
        const rows: Row[] = [
          ...expired.map((e) => {
            const item = stockById.get(e.batch.itemId);
            return {
              status: 'Expired' as const,
              itemName: item?.name ?? e.batch.itemId,
              batchCode: e.batch.batchCode,
              expiryDate: e.batch.expiryDate ?? '—',
              days: e.daysPastExpiry,
              remainingQty: e.batch.remainingQty,
              unit: item?.unit ?? '',
            };
          }),
          ...nearExpiry.map((n) => {
            const item = stockById.get(n.batch.itemId);
            return {
              status: 'Near expiry' as const,
              itemName: item?.name ?? n.batch.itemId,
              batchCode: n.batch.batchCode,
              expiryDate: n.batch.expiryDate ?? '—',
              days: n.daysToExpiry,
              remainingQty: n.batch.remainingQty,
              unit: item?.unit ?? '',
            };
          }),
        ].sort((a, b) => (a.status === b.status ? a.days - b.days : a.status === 'Expired' ? -1 : 1));

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Expired batches" value={String(expired.length)} helper={`As of ${formatISODateLabel(filters.toDate)}`} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Near-expiry (≤ 5 days)" value={String(nearExpiry.length)} helper="Remaining qty > 0" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Next expiry" value={nearExpiry[0] ? `${nearExpiry[0].batch.batchCode}` : '—'} helper={nearExpiry[0] ? `${nearExpiry[0].daysToExpiry} day(s)` : ''} />
              </Grid>
            </Grid>

            <SectionCard title="Expiry & near-expiry batches">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `expiry_${filters.toDate}`,
                        columns: [
                          { key: 'status', label: 'Status' },
                          { key: 'itemName', label: 'Item' },
                          { key: 'batchCode', label: 'BatchCode' },
                          { key: 'expiryDate', label: 'ExpiryDate' },
                          { key: 'days', label: 'DaysToOrPastExpiry' },
                          { key: 'remainingQty', label: 'RemainingQty' },
                          { key: 'unit', label: 'Unit' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No expired or near-expiry batches" />
                ) : (
                  <Table size="small" aria-label="Expiry report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell>Batch</TableCell>
                        <TableCell>Expiry</TableCell>
                        <TableCell align="right">Days</TableCell>
                        <TableCell align="right">Remaining</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.status}:${r.batchCode}`}>
                          <TableCell>{r.status}</TableCell>
                          <TableCell>{r.itemName}</TableCell>
                          <TableCell>{r.batchCode}</TableCell>
                          <TableCell>{r.expiryDate === '—' ? '—' : formatISODateShort(r.expiryDate as ISODate)}</TableCell>
                          <TableCell align="right">{r.status === 'Expired' ? `+${r.days}` : r.days}</TableCell>
                          <TableCell align="right">
                            {formatNumber(r.remainingQty)} {r.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'headcount-prep-serve-waste': {
        type Row = {
          date: ISODate;
          session: Session;
          expected: number;
          actual: number;
          preparedQty: number;
          servedQty: number;
          leftoverQty: number;
          wasteQty: number;
        };
        const dates = getDatesInRange(filters.fromDate, filters.toDate);
        const rows: Row[] = [];
        for (const d of dates) {
          const matrix = getHeadcountPrepServeWasteMatrixForDate(d, headcount, menuSessions, wasteEntries);
          for (const r of matrix) {
            if (supportsSession && filters.session !== 'All' && r.session !== filters.session) continue;
            rows.push({
              date: d,
              session: r.session,
              expected: r.headcountExpected,
              actual: r.headcountActual,
              preparedQty: r.preparedQty,
              servedQty: r.servedQty,
              leftoverQty: r.leftoverQty,
              wasteQty: r.wasteQty,
            });
          }
        }

        const totals = rows.reduce(
          (acc, r) => ({
            expected: acc.expected + r.expected,
            actual: acc.actual + r.actual,
            preparedQty: acc.preparedQty + r.preparedQty,
            servedQty: acc.servedQty + r.servedQty,
            leftoverQty: acc.leftoverQty + r.leftoverQty,
            wasteQty: acc.wasteQty + r.wasteQty,
          }),
          { expected: 0, actual: 0, preparedQty: 0, servedQty: 0, leftoverQty: 0, wasteQty: 0 },
        );

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <MetricCard label="Expected headcount" value={formatNumber(totals.expected)} helper="Sum in range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <MetricCard label="Actual served" value={formatNumber(totals.actual)} helper="Sum in range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <MetricCard label="Prepared qty" value={`${formatNumber(totals.preparedQty)} plates`} helper="Sum in range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <MetricCard label="Waste qty" value={`${formatNumber(totals.wasteQty)} plates`} helper="Sum in range" />
              </Grid>
            </Grid>

            <SectionCard title="Matrix rows">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `headcount-prep-serve-waste_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'date', label: 'Date' },
                          { key: 'session', label: 'Session' },
                          { key: 'expected', label: 'HeadcountExpected' },
                          { key: 'actual', label: 'HeadcountActual' },
                          { key: 'preparedQty', label: 'PreparedQty(plates)' },
                          { key: 'servedQty', label: 'ServedQty(plates)' },
                          { key: 'leftoverQty', label: 'LeftoverQty(plates)' },
                          { key: 'wasteQty', label: 'WasteQty(plates)' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No sessions in range" />
                ) : (
                  <Table size="small" aria-label="Headcount vs prep vs served vs waste table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell align="right">Expected</TableCell>
                        <TableCell align="right">Actual</TableCell>
                        <TableCell align="right">Prepared</TableCell>
                        <TableCell align="right">Served</TableCell>
                        <TableCell align="right">Leftover</TableCell>
                        <TableCell align="right">Waste</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.date}:${r.session}`}>
                          <TableCell>{formatISODateShort(r.date)}</TableCell>
                          <TableCell>{r.session}</TableCell>
                          <TableCell align="right">{formatNumber(r.expected)}</TableCell>
                          <TableCell align="right">{formatNumber(r.actual)}</TableCell>
                          <TableCell align="right">{formatNumber(r.preparedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.servedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.leftoverQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.wasteQty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'utilities': {
        type Row = { date: ISODate; electricity: number; water: number; lpg: number };
        const dates = getDatesInRange(filters.fromDate, filters.toDate);
        const rows: Row[] = dates.map((d) => {
          const totals = getUtilityTotalsForDate(utilityEntries, d);
          return { date: d, electricity: totals.Electricity, water: totals.Water, lpg: totals.LPG };
        });
        const electricityTotal = rows.reduce((sum, r) => sum + r.electricity, 0);
        const spikeDate = rows.slice().sort((a, b) => b.electricity - a.electricity)[0]?.date ?? null;

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Electricity total" value={`${formatNumber(electricityTotal)} kWh`} helper="Sum in range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Highest electricity day" value={spikeDate ? formatISODateShort(spikeDate) : '—'} helper={spikeDate ? `${formatNumber(rows.find((r) => r.date === spikeDate)?.electricity ?? 0)} kWh` : ''} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Days covered" value={String(rows.length)} helper="Date rows in report" />
              </Grid>
            </Grid>

            <ChartCard title="Electricity trend" summary="Electricity usage (kWh) per day">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis dataKey="date" tickFormatter={(d) => formatISODateShort(d as ISODate)} />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'kWh']} labelFormatter={(label) => `Date: ${formatISODateLabel(label as ISODate)}`} />
                    <Line type="monotone" dataKey="electricity" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Utilities (daily totals)">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `utilities_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'date', label: 'Date' },
                          { key: 'electricity', label: 'Electricity(kWh)' },
                          { key: 'water', label: 'Water(KL)' },
                          { key: 'lpg', label: 'LPG(kg)' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No utility data in range" />
                ) : (
                  <Table size="small" aria-label="Utilities report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Electricity (kWh)</TableCell>
                        <TableCell align="right">Water (KL)</TableCell>
                        <TableCell align="right">LPG (kg)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.date}>
                          <TableCell>{formatISODateShort(r.date)}</TableCell>
                          <TableCell align="right">{formatNumber(r.electricity)}</TableCell>
                          <TableCell align="right">{formatNumber(r.water)}</TableCell>
                          <TableCell align="right">{formatNumber(r.lpg)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'feedback-analysis': {
        type Row = {
          menuItemId: string;
          menuItemName: string;
          count: number;
          avgTaste: string;
          avgQuantity: string;
          avgQuality: string;
          avgPreference: string;
          avgSatisfaction: string;
          avgSatisfactionRaw: number;
        };
        const filtered = feedbackEntries.filter((f) => {
          if (!isISODateInRange(f.date, filters.fromDate, filters.toDate)) return false;
          if (supportsSession && filters.session !== 'All' && f.session !== filters.session) return false;
          return true;
        });
        const summaries = summarizeFeedbackByMenuItem(filtered, filters.fromDate, filters.toDate);
        const rows: Row[] = summaries
          .map((s) => ({
            menuItemId: s.menuItemId,
            menuItemName: menuById.get(s.menuItemId)?.name ?? s.menuItemId,
            count: s.count,
            avgTaste: s.avgTaste.toFixed(2),
            avgQuantity: s.avgQuantity.toFixed(2),
            avgQuality: s.avgQuality.toFixed(2),
            avgPreference: s.avgPreference.toFixed(2),
            avgSatisfaction: s.avgSatisfaction.toFixed(2),
            avgSatisfactionRaw: s.avgSatisfaction,
          }))
          .sort((a, b) => a.avgSatisfactionRaw - b.avgSatisfactionRaw);

        const overallAvg = filtered.length === 0 ? 0 : filtered.reduce((sum, f) => sum + f.satisfactionScore, 0) / filtered.length;

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Responses" value={String(filtered.length)} helper="Entries in selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Avg satisfaction" value={filtered.length === 0 ? '—' : overallAvg.toFixed(2)} helper="Across all responses" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Worst item" value={rows[0]?.menuItemName ?? '—'} helper={rows[0] ? `Avg: ${rows[0].avgSatisfaction} (${rows[0].count})` : ''} />
              </Grid>
            </Grid>

            <ChartCard title="Lowest-rated items" summary="Menu items with the lowest average satisfaction">
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.slice(0, 6)} layout="vertical" margin={{ left: 32 }}>
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" />
                    <XAxis type="number" domain={[1, 5]} />
                    <YAxis type="category" dataKey="menuItemName" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [Number(value).toFixed(2), 'Avg satisfaction']} />
                    <Bar dataKey="avgSatisfactionRaw" fill={theme.palette.warning.main} radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <SectionCard title="Feedback summaries (by menu item)">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `feedback-analysis_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'menuItemName', label: 'MenuItem' },
                          { key: 'count', label: 'Responses' },
                          { key: 'avgTaste', label: 'AvgTaste' },
                          { key: 'avgQuantity', label: 'AvgQuantity' },
                          { key: 'avgQuality', label: 'AvgQuality' },
                          { key: 'avgPreference', label: 'AvgPreference' },
                          { key: 'avgSatisfaction', label: 'AvgSatisfaction' },
                        ],
                        rows: rows.map((r) => ({
                          menuItemName: r.menuItemName,
                          count: r.count,
                          avgTaste: r.avgTaste,
                          avgQuantity: r.avgQuantity,
                          avgQuality: r.avgQuality,
                          avgPreference: r.avgPreference,
                          avgSatisfaction: r.avgSatisfaction,
                        })),
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No feedback in range" />
                ) : (
                  <Table size="small" aria-label="Feedback analysis table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Menu item</TableCell>
                        <TableCell align="right">Responses</TableCell>
                        <TableCell align="right">Taste</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Quality</TableCell>
                        <TableCell align="right">Preference</TableCell>
                        <TableCell align="right">Satisfaction</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.menuItemId}>
                          <TableCell>{r.menuItemName}</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                          <TableCell align="right">{r.avgTaste}</TableCell>
                          <TableCell align="right">{r.avgQuantity}</TableCell>
                          <TableCell align="right">{r.avgQuality}</TableCell>
                          <TableCell align="right">{r.avgPreference}</TableCell>
                          <TableCell align="right">{r.avgSatisfaction}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'request-issue': {
        type ReqRow = {
          requestNo: string;
          date: ISODate;
          item: string;
          requestedQty: number;
          issuedQty: number;
          pendingQty: number;
          status: string;
          urgency: string;
          ageDays: number;
        };
        type IssueRow = { occurredAt: string; requestNo: string; item: string; issuedQty: number; issuedBy: string; remarks: string };

        const reqRows: ReqRow[] = requests
          .filter((r) => isISODateInRange(r.date, filters.fromDate, filters.toDate))
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || b.requestNo.localeCompare(a.requestNo))
          .map((r) => ({
            requestNo: r.requestNo,
            date: r.date,
            item: stockById.get(r.itemId)?.name ?? r.itemId,
            requestedQty: r.requestedQty,
            issuedQty: r.issuedQty,
            pendingQty: Math.max(0, r.requestedQty - r.issuedQty),
            status: r.status,
            urgency: r.urgency,
            ageDays: differenceInCalendarDays(parseISO(filters.toDate), parseISO(r.date)),
          }));

        const requestById = new Map(requests.map((r) => [r.id, r]));
        const issueRows: IssueRow[] = issueEvents
          .filter((e) => isISODateInRange(e.occurredAt.slice(0, 10) as ISODate, filters.fromDate, filters.toDate))
          .slice()
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .map((e) => {
            const req = requestById.get(e.requestId);
            return {
              occurredAt: e.occurredAt,
              requestNo: req?.requestNo ?? e.requestId,
              item: stockById.get(e.itemId)?.name ?? e.itemId,
              issuedQty: e.issuedQty,
              issuedBy: e.issuedByLabel,
              remarks: e.remarks ?? '',
            };
          });

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Requests" value={String(reqRows.length)} helper="In selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Issue events" value={String(issueRows.length)} helper="In selected range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Pending requests" value={String(reqRows.filter((r) => ['Requested', 'Approved', 'Partially Issued'].includes(r.status)).length)} helper="Open workflow items" />
              </Grid>
            </Grid>

            <SectionCard title="Requests">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `requests_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'requestNo', label: 'RequestNo' },
                          { key: 'date', label: 'Date' },
                          { key: 'item', label: 'Item' },
                          { key: 'requestedQty', label: 'RequestedQty' },
                          { key: 'issuedQty', label: 'IssuedQty' },
                          { key: 'pendingQty', label: 'PendingQty' },
                          { key: 'status', label: 'Status' },
                          { key: 'urgency', label: 'Urgency' },
                          { key: 'ageDays', label: 'AgeDays' },
                        ],
                        rows: reqRows.map((r) => ({
                          requestNo: r.requestNo,
                          date: r.date,
                          item: r.item,
                          requestedQty: r.requestedQty,
                          issuedQty: r.issuedQty,
                          pendingQty: r.pendingQty,
                          status: r.status,
                          urgency: r.urgency,
                          ageDays: r.ageDays,
                        })),
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {reqRows.length === 0 ? (
                  <EmptyState title="No requests in range" />
                ) : (
                  <Table size="small" aria-label="Requests report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Request</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Requested</TableCell>
                        <TableCell align="right">Issued</TableCell>
                        <TableCell align="right">Pending</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Urgency</TableCell>
                        <TableCell align="right">Age (days)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reqRows.map((r) => (
                        <TableRow key={r.requestNo}>
                          <TableCell>{r.requestNo}</TableCell>
                          <TableCell>{formatISODateShort(r.date)}</TableCell>
                          <TableCell>{r.item}</TableCell>
                          <TableCell align="right">{formatNumber(r.requestedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.issuedQty)}</TableCell>
                          <TableCell align="right">{formatNumber(r.pendingQty)}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell>{r.urgency}</TableCell>
                          <TableCell align="right">{r.ageDays}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>

            <SectionCard title="Issue history">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `issue-events_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'occurredAt', label: 'OccurredAt' },
                          { key: 'requestNo', label: 'RequestNo' },
                          { key: 'item', label: 'Item' },
                          { key: 'issuedQty', label: 'IssuedQty' },
                          { key: 'issuedBy', label: 'IssuedBy' },
                          { key: 'remarks', label: 'Remarks' },
                        ],
                        rows: issueRows.map((r) => ({
                          occurredAt: r.occurredAt,
                          requestNo: r.requestNo,
                          item: r.item,
                          issuedQty: r.issuedQty,
                          issuedBy: r.issuedBy,
                          remarks: r.remarks,
                        })),
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {issueRows.length === 0 ? (
                  <EmptyState title="No issue events in range" />
                ) : (
                  <Table size="small" aria-label="Issue events report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>When</TableCell>
                        <TableCell>Request</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Issued qty</TableCell>
                        <TableCell>Issued by</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {issueRows.map((r) => (
                        <TableRow key={r.occurredAt}>
                          <TableCell>{format(parseISO(r.occurredAt), 'dd MMM, HH:mm')}</TableCell>
                          <TableCell>{r.requestNo}</TableCell>
                          <TableCell>{r.item}</TableCell>
                          <TableCell align="right">{formatNumber(r.issuedQty)}</TableCell>
                          <TableCell>{r.issuedBy}</TableCell>
                          <TableCell sx={{ maxWidth: 380 }}>{r.remarks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      case 'stock-variance': {
        type Row = {
          itemName: string;
          unit: StockItem['unit'];
          receipts: number;
          issues: number;
          adjustments: number;
          netMovement: number;
          closingOnHand: number;
          impliedOpening: number;
          adjustmentEvents: number;
        };

        const inRangeTx = stockTransactions.filter((t) => {
          const d = t.occurredAt.slice(0, 10) as ISODate;
          return isISODateInRange(d, filters.fromDate, filters.toDate);
        });

        const byItem = new Map<string, { receipts: number; issues: number; adjustments: number; adjustmentEvents: number }>();
        for (const tx of inRangeTx) {
          const current = byItem.get(tx.itemId) ?? { receipts: 0, issues: 0, adjustments: 0, adjustmentEvents: 0 };
          if (tx.type === 'Receipt' || tx.type === 'Return') current.receipts += Math.max(0, tx.qty);
          if (tx.type === 'Issue') current.issues += Math.abs(tx.qty);
          if (tx.type === 'Adjustment') {
            current.adjustments += tx.qty;
            current.adjustmentEvents += 1;
          }
          byItem.set(tx.itemId, current);
        }

        const rows: Row[] = stockItems
          .map((item) => {
            const t = byItem.get(item.id) ?? { receipts: 0, issues: 0, adjustments: 0, adjustmentEvents: 0 };
            const closingOnHand = stockBatches.filter((b) => b.itemId === item.id).reduce((sum, b) => sum + b.remainingQty, 0);
            const netMovement = t.receipts - t.issues + t.adjustments;
            const impliedOpening = closingOnHand - netMovement;
            return {
              itemName: item.name,
              unit: item.unit,
              receipts: t.receipts,
              issues: t.issues,
              adjustments: t.adjustments,
              netMovement,
              closingOnHand,
              impliedOpening,
              adjustmentEvents: t.adjustmentEvents,
            };
          })
          .filter((r) => r.receipts !== 0 || r.issues !== 0 || r.adjustments !== 0 || r.adjustmentEvents !== 0)
          .sort((a, b) => b.adjustmentEvents - a.adjustmentEvents || b.issues - a.issues);

        return (
          <Stack spacing={2}>
            {printHeader}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Items with movements" value={String(rows.length)} helper="Receipts/issues/adjustments in range" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Items with adjustments" value={String(rows.filter((r) => r.adjustmentEvents > 0).length)} helper="Variance drivers" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard label="Most adjusted item" value={rows.find((r) => r.adjustmentEvents > 0)?.itemName ?? '—'} helper="Based on adjustment events" />
              </Grid>
            </Grid>

            <SectionCard title="Stock variance (movement summary)">
              <TableShell
                title="Rows"
                actions={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      exportRowsAsCsv({
                        filename: `stock-variance_${filters.fromDate}_to_${filters.toDate}`,
                        columns: [
                          { key: 'itemName', label: 'Item' },
                          { key: 'unit', label: 'Unit' },
                          { key: 'receipts', label: 'Receipts' },
                          { key: 'issues', label: 'Issues' },
                          { key: 'adjustments', label: 'Adjustments(net)' },
                          { key: 'netMovement', label: 'NetMovement' },
                          { key: 'closingOnHand', label: 'ClosingOnHand' },
                          { key: 'impliedOpening', label: 'ImpliedOpening' },
                          { key: 'adjustmentEvents', label: 'AdjustmentEvents' },
                        ],
                        rows,
                      })
                    }
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    Export CSV
                  </Button>
                }
              >
                {rows.length === 0 ? (
                  <EmptyState title="No stock movements in range" />
                ) : (
                  <Table size="small" aria-label="Stock variance report table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Receipts</TableCell>
                        <TableCell align="right">Issues</TableCell>
                        <TableCell align="right">Adjustments</TableCell>
                        <TableCell align="right">Net</TableCell>
                        <TableCell align="right">Closing</TableCell>
                        <TableCell align="right">Implied opening</TableCell>
                        <TableCell align="right">Adj. events</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.itemName}>
                          <TableCell>{r.itemName}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell align="right">{formatNumber(r.receipts)}</TableCell>
                          <TableCell align="right">{formatNumber(r.issues)}</TableCell>
                          <TableCell align="right">{r.adjustments === 0 ? '0' : `${r.adjustments > 0 ? '+' : ''}${formatNumber(r.adjustments)}`}</TableCell>
                          <TableCell align="right">{r.netMovement === 0 ? '0' : `${r.netMovement > 0 ? '+' : ''}${formatNumber(r.netMovement)}`}</TableCell>
                          <TableCell align="right">{formatNumber(r.closingOnHand)}</TableCell>
                          <TableCell align="right">{formatNumber(r.impliedOpening)}</TableCell>
                          <TableCell align="right">{r.adjustmentEvents}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </SectionCard>
          </Stack>
        );
      }

      default:
        return (
          <EmptyState
            title="Report not implemented"
            description="This report key exists in the catalogue but does not render yet."
          />
        );
    }
  })();

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Filterable operational reports with CSV export and print view."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ '@media print': { display: 'none' } }}>
          <SectionCard title="Report Catalogue">
            <List dense disablePadding aria-label="Report catalogue">
              {reportDefinitions.map((def) => {
                const selected = def.key === selectedReportKey;
                return (
                  <ListItemButton
                    key={def.key}
                    selected={selected}
                    onClick={() => setSelectedReportKey(def.key)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText primary={toReportKeyLabel(def, selected)} />
                  </ListItemButton>
                );
              })}
            </List>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard
            title={selectedDef?.title ?? 'Report Preview'}
            actions={
              <Stack direction="row" spacing={1} alignItems="center" sx={{ '@media print': { display: 'none' } }}>
                {printButton}
              </Stack>
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedDef?.description ?? '—'}
            </Typography>

            <Box sx={{ '@media print': { display: 'none' } }}>
              <FilterBar
                right={
                  <Typography variant="caption" color="text.secondary">
                    Range: {formatISODateShort(filters.fromDate)} → {formatISODateShort(filters.toDate)}
                  </Typography>
                }
              >
                <TextField
                  size="small"
                  label="From"
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters({ fromDate: e.target.value as ISODate })}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  size="small"
                  label="To"
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters({ toDate: e.target.value as ISODate })}
                  InputLabelProps={{ shrink: true }}
                />

                {supportsSession ? (
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="report-session-label">Session</InputLabel>
                    <Select
                      labelId="report-session-label"
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
                ) : null}
              </FilterBar>
            </Box>

            <Divider sx={{ my: 2, '@media print': { display: 'none' } }} />
            {preview}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
