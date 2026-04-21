'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import {
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
  Cell,
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
  detectUtilitySpike,
  getBatchesNearExpiry,
  getExpiredBatches,
  getItemsBelowReorder,
  getMembersServedForDate,
  getRawMaterialsIssuedForDate,
  getWasteTotalForDate,
  getWeekDateRange,
  isISODateInRange,
  summarizeFeedbackByMenuItem,
} from '@/lib/analytics';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useRecommendationStore } from '@/stores/useRecommendationStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate, Session } from '@/types/common';
import type { NotificationItem } from '@/types/notification';
import type { RecommendationSeverity } from '@/types/recommendation';
import type { AppRole } from '@/types/role';
import type { RequisitionRequest } from '@/types/request';

type RangePreset = 'last7' | 'last14' | 'custom';
type WidgetKey =
  | 'kpis'
  | 'alerts'
  | 'dailyWaste'
  | 'weeklyWaste'
  | 'sessionWaste'
  | 'menuLeftovers'
  | 'matrix'
  | 'stockRisk'
  | 'feedback'
  | 'recommendations'
  | 'recentRequests'
  | 'utilities';

type DashboardCta = {
  label: string;
  href: string;
  variant?: 'contained' | 'outlined' | 'text';
};

function formatShortDate(date: ISODate): string {
  return format(parseISO(date), 'MMM d');
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

function toRecommendationChipColor(severity: RecommendationSeverity) {
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

function toRequestStatusChipColor(status: RequisitionRequest['status']) {
  switch (status) {
    case 'Requested':
      return 'info' as const;
    case 'Approved':
      return 'primary' as const;
    case 'Partially Issued':
      return 'warning' as const;
    case 'Issued':
      return 'success' as const;
    case 'Rejected':
      return 'error' as const;
    case 'Closed':
    default:
      return 'default' as const;
  }
}

function getWidgetOrderForRole(role: AppRole): WidgetKey[] {
  const all: WidgetKey[] = [
    'kpis',
    'alerts',
    'dailyWaste',
    'weeklyWaste',
    'sessionWaste',
    'menuLeftovers',
    'matrix',
    'stockRisk',
    'recentRequests',
    'feedback',
    'utilities',
    'recommendations',
  ];

  switch (role) {
    case 'Chef':
      return [
        'kpis',
        'menuLeftovers',
        'sessionWaste',
        'dailyWaste',
        'feedback',
        'recommendations',
        'recentRequests',
        'alerts',
      ];
    case 'Store Manager':
      return [
        'kpis',
        'stockRisk',
        'recentRequests',
        'alerts',
        'weeklyWaste',
        'recommendations',
      ];
    case 'Canteen Manager':
      return [
        'kpis',
        'alerts',
        'dailyWaste',
        'sessionWaste',
        'menuLeftovers',
        'utilities',
        'feedback',
        'weeklyWaste',
        'recommendations',
      ];
    case 'Management':
      return [
        'kpis',
        'weeklyWaste',
        'dailyWaste',
        'stockRisk',
        'recommendations',
        'alerts',
      ];
    case 'Admin':
    default:
      return all;
  }
}

function getDashboardSubtitleForRole(role: AppRole): string {
  switch (role) {
    case 'Chef':
      return 'Chef view: focus on timetable, leftovers, waste, and requisitions.';
    case 'Store Manager':
      return 'Store view: focus on stock risk, pending issues, and requisitions.';
    case 'Canteen Manager':
      return 'Operations view: focus on waste, utilities, feedback, and service quality.';
    case 'Management':
      return 'Management view: focus on KPIs, trends, top risks, and required actions.';
    case 'Admin':
    default:
      return 'Operations cockpit: waste, headcount, stock risk, feedback, requests, and utilities.';
  }
}

function getDashboardCtasForRole(role: AppRole): DashboardCta[] {
  switch (role) {
    case 'Chef':
      return [
        { label: 'Plan timetable', href: '/menu-consumption', variant: 'contained' },
        { label: 'New requisition', href: '/requests', variant: 'outlined' },
      ];
    case 'Store Manager':
      return [
        { label: 'Pending issues', href: '/requests?view=pending', variant: 'contained' },
        { label: 'Open stock', href: '/stock', variant: 'outlined' },
      ];
    case 'Canteen Manager':
      return [
        { label: 'Log waste', href: '/waste-utilities', variant: 'contained' },
        { label: 'Open feedback', href: '/feedback', variant: 'outlined' },
      ];
    case 'Management':
      return [
        { label: 'Open reports', href: '/reports', variant: 'contained' },
        { label: 'Recommendations', href: '/recommendations', variant: 'outlined' },
      ];
    case 'Admin':
    default:
      return [];
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const theme = useTheme();

  const role = useRoleStore((s) => s.role);
  const asOfDate = useDashboardStore((s) => s.asOfDate);
  const filters = useDashboardStore((s) => s.filters);
  const setAsOfDate = useDashboardStore((s) => s.setAsOfDate);
  const setFilters = useDashboardStore((s) => s.setFilters);
  const resetDashboard = useDashboardStore((s) => s.resetToSeed);

  const menuItems = useMenuStore((s) => s.menuItems);
  const menuSessions = useMenuStore((s) => s.menuSessions);
  const headcount = useHeadcountStore((s) => s.headcount);
  const wasteEntries = useWasteStore((s) => s.wasteEntries);
  const utilityEntries = useUtilitiesStore((s) => s.utilityEntries);
  const stockItems = useStockStore((s) => s.stockItems);
  const stockBatches = useStockStore((s) => s.stockBatches);
  const stockTransactions = useStockStore((s) => s.stockTransactions);
  const requests = useRequestStore((s) => s.requests);
  const feedbackEntries = useFeedbackStore((s) => s.feedbackEntries);

  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const regenerateNotifications = useNotificationStore((s) => s.regenerate);

  const recommendations = useRecommendationStore((s) => s.recommendations);
  const regenerateRecommendations = useRecommendationStore((s) => s.regenerate);

  const preset: RangePreset = React.useMemo(() => {
    const last7From = addDaysISODate(asOfDate, -6);
    const last14From = addDaysISODate(asOfDate, -13);
    if (filters.fromDate === last7From && filters.toDate === asOfDate) return 'last7';
    if (filters.fromDate === last14From && filters.toDate === asOfDate) return 'last14';
    return 'custom';
  }, [asOfDate, filters.fromDate, filters.toDate]);

  const formatNumber = React.useMemo(() => new Intl.NumberFormat('en-IN'), []);
  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const stockById = React.useMemo(() => new Map(stockItems.map((i) => [i.id, i])), [stockItems]);

  const wasteTodayTotal = React.useMemo(() => {
    if (filters.session === 'All') return getWasteTotalForDate(wasteEntries, asOfDate);
    return wasteEntries
      .filter((w) => w.date === asOfDate && w.session === filters.session)
      .reduce((sum, w) => sum + w.wasteQty, 0);
  }, [asOfDate, filters.session, wasteEntries]);

  const wasteWeekTotal = React.useMemo(() => {
    const { fromDate, toDate } = getWeekDateRange(asOfDate);
    const entries = wasteEntries.filter(
      (w) =>
        isISODateInRange(w.date, fromDate, toDate) &&
        (filters.session === 'All' ? true : w.session === filters.session),
    );
    return entries.reduce((sum, w) => sum + w.wasteQty, 0);
  }, [asOfDate, filters.session, wasteEntries]);

  const membersServedToday = React.useMemo(() => {
    if (filters.session === 'All') return getMembersServedForDate(headcount, asOfDate);
    return headcount
      .filter((h) => h.date === asOfDate && h.session === filters.session)
      .reduce((sum, h) => sum + h.actual, 0);
  }, [asOfDate, filters.session, headcount]);

  const rawIssuedToday = React.useMemo(
    () => getRawMaterialsIssuedForDate(stockItems, stockTransactions, asOfDate),
    [asOfDate, stockItems, stockTransactions],
  );

  const datesInRange = React.useMemo(() => getDatesInRange(filters.fromDate, filters.toDate), [filters.fromDate, filters.toDate]);

  const dailyWasteSeries = React.useMemo(() => {
    return datesInRange.map((d) => {
      const total =
        filters.session === 'All'
          ? getWasteTotalForDate(wasteEntries, d)
          : wasteEntries
              .filter((w) => w.date === d && w.session === filters.session)
              .reduce((sum, w) => sum + w.wasteQty, 0);
      return { dateLabel: formatShortDate(d), isoDate: d, wasteQty: total };
    });
  }, [datesInRange, filters.session, wasteEntries]);

  const weeklyWasteSeries = React.useMemo(() => {
    const { fromDate: thisWeekStart } = getWeekDateRange(asOfDate);
    const prevWeekStart = addDaysISODate(thisWeekStart, -7);
    const prevWeekEnd = addDaysISODate(thisWeekStart, -1);

    const prevWeek = wasteEntries
      .filter(
        (w) =>
          isISODateInRange(w.date, prevWeekStart, prevWeekEnd) &&
          (filters.session === 'All' ? true : w.session === filters.session),
      )
      .reduce((sum, w) => sum + w.wasteQty, 0);

    const thisWeek = wasteEntries
      .filter(
        (w) =>
          isISODateInRange(w.date, thisWeekStart, asOfDate) &&
          (filters.session === 'All' ? true : w.session === filters.session),
      )
      .reduce((sum, w) => sum + w.wasteQty, 0);

    return [
      { label: 'Previous week', wasteQty: prevWeek },
      { label: 'This week', wasteQty: thisWeek },
    ];
  }, [asOfDate, filters.session, wasteEntries]);

  const sessionWasteTotals = React.useMemo(() => {
    const totals: Record<Session, number> = { Breakfast: 0, Lunch: 0, 'Dinner 1': 0, 'Dinner 2': 0 };
    for (const entry of wasteEntries) {
      if (!isISODateInRange(entry.date, filters.fromDate, filters.toDate)) continue;
      totals[entry.session] += entry.wasteQty;
    }
    return (['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'] as const).map((session) => ({
      session,
      wasteQty: totals[session],
    }));
  }, [filters.fromDate, filters.toDate, wasteEntries]);

  const menuLeftovers = React.useMemo(() => {
    const targetSessions = menuSessions.filter(
      (s) =>
        s.date === asOfDate && (filters.session === 'All' ? true : s.session === filters.session),
    );
    const totalsByMenu = new Map<string, number>();
    for (const s of targetSessions) {
      totalsByMenu.set(s.menuItemId, (totalsByMenu.get(s.menuItemId) ?? 0) + s.leftoverQty);
    }
    return Array.from(totalsByMenu.entries())
      .map(([menuItemId, leftoverQty]) => ({
        menuItemId,
        menuItemName: menuById.get(menuItemId)?.name ?? menuItemId,
        leftoverQty,
      }))
      .sort((a, b) => b.leftoverQty - a.leftoverQty)
      .slice(0, 6);
  }, [asOfDate, filters.session, menuById, menuSessions]);

  const matrixRows = React.useMemo(() => {
    const sessions: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];
    return sessions
      .filter((s) => (filters.session === 'All' ? true : s === filters.session))
      .map((session) => {
        const hc = headcount.find((h) => h.date === asOfDate && h.session === session);
        const ms = menuSessions.find((m) => m.date === asOfDate && m.session === session);
        const waste = wasteEntries.find((w) => w.date === asOfDate && w.session === session);
        return {
          session,
          headcountExpected: hc?.expected ?? 0,
          headcountActual: hc?.actual ?? 0,
          preparedQty: ms?.preparedQty ?? 0,
          servedQty: ms?.servedQty ?? 0,
          leftoverQty: ms?.leftoverQty ?? 0,
          wasteQty: waste?.wasteQty ?? 0,
        };
      });
  }, [asOfDate, filters.session, headcount, menuSessions, wasteEntries]);

  const stockAlerts = React.useMemo(() => {
    const belowReorder = getItemsBelowReorder(stockItems, stockBatches);
    const nearExpiry = getBatchesNearExpiry(stockBatches, asOfDate, 2).map((row) => ({
      ...row,
      itemName: stockById.get(row.batch.itemId)?.name ?? row.batch.itemId,
      unit: stockById.get(row.batch.itemId)?.unit ?? 'kg',
    }));
    const expired = getExpiredBatches(stockBatches, asOfDate).map((row) => ({
      ...row,
      itemName: stockById.get(row.batch.itemId)?.name ?? row.batch.itemId,
      unit: stockById.get(row.batch.itemId)?.unit ?? 'kg',
    }));
    return { belowReorder, nearExpiry, expired };
  }, [asOfDate, stockBatches, stockById, stockItems]);

  const feedbackSummary = React.useMemo(() => {
    const { fromDate, toDate } = getWeekDateRange(asOfDate);
    const weekEntries = feedbackEntries.filter((f) => isISODateInRange(f.date, fromDate, toDate));
    const avgSatisfaction =
      weekEntries.length === 0 ? 0 : weekEntries.reduce((sum, f) => sum + f.satisfactionScore, 0) / weekEntries.length;

    const summaries = summarizeFeedbackByMenuItem(feedbackEntries, fromDate, toDate);
    const low = summaries
      .filter((s) => s.count >= 2 && s.avgSatisfaction <= 2.6)
      .slice()
      .sort((a, b) => a.avgSatisfaction - b.avgSatisfaction)
      .slice(0, 3)
      .map((s) => ({
        ...s,
        menuItemName: menuById.get(s.menuItemId)?.name ?? s.menuItemId,
      }));

    return { avgSatisfaction, weekCount: weekEntries.length, lowItems: low };
  }, [asOfDate, feedbackEntries, menuById]);

  const topRecommendations = React.useMemo(() => {
    const rank: Record<RecommendationSeverity, number> = { High: 0, Medium: 1, Low: 2 };
    return recommendations
      .slice()
      .sort((a, b) => rank[a.severity] - rank[b.severity])
      .slice(0, 3);
  }, [recommendations]);

  const recentRequests = React.useMemo(() => {
    const sorted = requests
      .slice()
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return b.requestNo.localeCompare(a.requestNo);
      })
      .slice(0, 5)
      .map((r) => ({
        ...r,
        itemName: stockById.get(r.itemId)?.name ?? r.itemId,
      }));

    const pendingCount = requests.filter((r) => ['Requested', 'Approved', 'Partially Issued'].includes(r.status)).length;
    return { sorted, pendingCount };
  }, [requests, stockById]);

  const utilitiesSummary = React.useMemo(() => {
    const today = utilityEntries.filter((u) => u.date === asOfDate);
    const totals = today.reduce(
      (acc, u) => ({ ...acc, [u.utilityType]: acc[u.utilityType] + u.amount }),
      { Electricity: 0, Water: 0, LPG: 0 } as Record<'Electricity' | 'Water' | 'LPG', number>,
    );

    const electricitySeries = datesInRange.map((d) => {
      const amount = utilityEntries
        .filter((u) => u.utilityType === 'Electricity' && u.date === d)
        .reduce((sum, u) => sum + u.amount, 0);
      return { dateLabel: formatShortDate(d), isoDate: d, amount };
    });

    const spikes = datesInRange
      .map((d) => ({ date: d, spike: detectUtilitySpike({ utilityEntries, asOfDate: d, utilityType: 'Electricity', lookbackDays: 7, spikeRatioThreshold: 1.35 }) }))
      .filter((x) => x.spike.isSpike);

    const latestSpike = spikes.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    return { totals, electricitySeries, latestSpikeDate: latestSpike?.date ?? null };
  }, [asOfDate, datesInRange, utilityEntries]);

  const widgetOrder = React.useMemo(() => getWidgetOrderForRole(role), [role]);
  const dashboardSubtitle = React.useMemo(() => getDashboardSubtitleForRole(role), [role]);
  const dashboardCtas = React.useMemo(() => getDashboardCtasForRole(role), [role]);

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

    if (n.sourceModule === 'Stock & Inventory') {
      router.push('/stock');
      return;
    }
    if (n.sourceModule === 'Waste & Utilities') {
      router.push(`/waste-utilities?date=${encodeURIComponent(asOfDate)}`);
      return;
    }
    if (n.sourceModule === 'Feedback') {
      router.push('/feedback');
      return;
    }
    if (n.sourceModule === 'Requests & Issues') {
      router.push('/requests');
      return;
    }
    if (n.sourceModule === 'Recommendations') {
      router.push('/recommendations');
      return;
    }
    if (n.sourceModule === 'Reports') {
      router.push('/reports');
      return;
    }
    router.push('/notifications');
  };

  const kpisWidget = (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          label={filters.session === 'All' ? 'Waste Today' : `Waste Today — ${filters.session}`}
          value={`${formatNumber.format(wasteTodayTotal)} plates`}
          helper={`As of ${formatShortDate(asOfDate)}`}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          label={filters.session === 'All' ? 'Waste This Week' : `Waste This Week — ${filters.session}`}
          value={`${formatNumber.format(wasteWeekTotal)} plates`}
          helper="Week to date (Mon–today)"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          label={filters.session === 'All' ? 'Members Served Today' : `Members Served Today — ${filters.session}`}
          value={formatNumber.format(membersServedToday)}
          helper="Headcount (actual)"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          label="Raw Materials Issued Today"
          value={`${formatNumber.format(rawIssuedToday.totalsByUnit.kg)} kg • ${formatNumber.format(
            rawIssuedToday.totalsByUnit.l,
          )} l`}
          helper={`${rawIssuedToday.transactionCount} issue record(s)`}
        />
      </Grid>
    </Grid>
  );

  const alertsWidget = (
    <SectionCard
      title="Alerts & Notifications"
      actions={
        <Button size="small" onClick={() => router.push('/notifications')} aria-label="Open notifications">
          View all
        </Button>
      }
    >
      <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {notifications.slice(0, 6).map((n) => (
          <ListItemButton
            key={n.id}
            onClick={() => handleNotificationClick(n)}
            sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <StatusChip label={n.severity.toUpperCase()} color={toSeverityChipColor(n.severity)} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: n.read ? 600 : 800 }} noWrap>
                  {n.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {n.message}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {format(parseISO(n.createdAt), 'MMM d, HH:mm')}
              </Typography>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </SectionCard>
  );

  const dailyWasteWidget = (
    <ChartCard
      title="Daily Waste Trend"
      summary={`Daily waste totals from ${formatShortDate(filters.fromDate)} to ${formatShortDate(filters.toDate)}.`}
    >
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyWasteSeries} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
            <CartesianGrid stroke={theme.palette.divider} vertical={false} />
            <XAxis
              dataKey="isoDate"
              tickFormatter={(value) => formatShortDate(String(value) as ISODate)}
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
              formatter={(value) => [`${value ?? 0} plates`, 'Waste']}
            />
            <Line
              type="monotone"
              dataKey="wasteQty"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );

  const weeklyWasteWidget = (
    <ChartCard
      title="Weekly Waste Trend"
      summary="Week-to-date waste compared with previous week."
    >
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyWasteSeries} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
            <CartesianGrid stroke={theme.palette.divider} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: theme.palette.divider }} />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
              width={38}
              allowDecimals={false}
            />
            <Tooltip formatter={(value) => [`${value ?? 0} plates`, 'Waste']} />
            <Bar dataKey="wasteQty" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );

  const sessionWasteWidget = (
    <ChartCard
      title="Session-wise Waste"
      summary={`Waste totals by session from ${formatShortDate(filters.fromDate)} to ${formatShortDate(filters.toDate)}.`}
    >
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sessionWasteTotals} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
            <CartesianGrid stroke={theme.palette.divider} vertical={false} />
            <XAxis dataKey="session" tickLine={false} axisLine={{ stroke: theme.palette.divider }} />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
              width={38}
              allowDecimals={false}
            />
            <Tooltip formatter={(value) => [`${value ?? 0} plates`, 'Waste']} />
            <Bar dataKey="wasteQty" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {sessionWasteTotals.map((row) => (
                <Cell
                  key={row.session}
                  fill={
                    filters.session !== 'All' && row.session === filters.session
                      ? theme.palette.primary.main
                      : theme.palette.primary.light
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );

  const menuLeftoversWidget = (
    <ChartCard
      title="Menu-wise Leftovers"
      summary={`Top leftover items for ${formatShortDate(asOfDate)}${filters.session === 'All' ? '' : ` (${filters.session})`}.`}
    >
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={menuLeftovers} layout="vertical" margin={{ left: 12, right: 16, top: 10, bottom: 10 }}>
            <CartesianGrid stroke={theme.palette.divider} horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="menuItemName"
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
              width={120}
            />
            <Tooltip formatter={(value) => [`${value ?? 0} plates`, 'Leftover']} />
            <Bar dataKey="leftoverQty" fill={theme.palette.primary.main} radius={[0, 6, 6, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );

  const matrixWidget = (
    <SectionCard
      title="Headcount vs Prepared vs Served vs Waste"
      actions={
        <Button size="small" onClick={() => router.push(`/menu-consumption?date=${encodeURIComponent(asOfDate)}`)}>
          Open module
        </Button>
      }
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Comparison matrix for {formatShortDate(asOfDate)}
        {filters.session === 'All' ? '' : ` — ${filters.session}`}.
      </Typography>
      <Table size="small" aria-label="Headcount vs prepared vs served vs waste table">
        <TableHead>
          <TableRow>
            <TableCell>Session</TableCell>
            <TableCell align="right">Headcount (Exp)</TableCell>
            <TableCell align="right">Headcount (Act)</TableCell>
            <TableCell align="right">Prepared</TableCell>
            <TableCell align="right">Served</TableCell>
            <TableCell align="right">Leftover</TableCell>
            <TableCell align="right">Waste</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matrixRows.map((row) => (
            <TableRow key={row.session}>
              <TableCell sx={{ fontWeight: 700 }}>{row.session}</TableCell>
              <TableCell align="right">{formatNumber.format(row.headcountExpected)}</TableCell>
              <TableCell align="right">{formatNumber.format(row.headcountActual)}</TableCell>
              <TableCell align="right">{formatNumber.format(row.preparedQty)}</TableCell>
              <TableCell align="right">{formatNumber.format(row.servedQty)}</TableCell>
              <TableCell align="right">{formatNumber.format(row.leftoverQty)}</TableCell>
              <TableCell align="right">{formatNumber.format(row.wasteQty)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );

  const stockRiskWidget = (
    <SectionCard
      title="Stock Risk (Reorder + Expiry)"
      actions={
        <Button size="small" onClick={() => router.push('/stock')} aria-label="Open stock module">
          Open stock
        </Button>
      }
    >
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
        <StatusChip
          label={`${stockAlerts.belowReorder.length} below reorder`}
          color={stockAlerts.belowReorder.length > 0 ? 'warning' : 'default'}
        />
        <StatusChip
          label={`${stockAlerts.nearExpiry.length} near expiry (≤2d)`}
          color={stockAlerts.nearExpiry.length > 0 ? 'warning' : 'default'}
        />
        <StatusChip
          label={`${stockAlerts.expired.length} expired`}
          color={stockAlerts.expired.length > 0 ? 'error' : 'default'}
        />
      </Stack>

      <Stack spacing={1.5}>
        <Box>
          <TableShell title="Below reorder (top 3)">
            <Table size="small" aria-label="Below reorder table">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">On-hand</TableCell>
                  <TableCell align="right">Reorder</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockAlerts.belowReorder.slice(0, 3).map((row) => (
                  <TableRow
                    key={row.itemId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/stock?itemId=${encodeURIComponent(row.itemId)}`)}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{row.itemName}</TableCell>
                    <TableCell align="right">
                      {formatNumber.format(row.onHandQty)} {row.unit}
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber.format(row.reorderLevel)} {row.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </Box>

        <Divider />

        <Box>
          <TableShell title="Expiry risk (top 3)">
            <Table size="small" aria-label="Expiry risk table">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell align="right">Remaining</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockAlerts.expired.slice(0, 2).map((row) => (
                  <TableRow
                    key={row.batch.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/stock?batchId=${encodeURIComponent(row.batch.id)}`)}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{row.itemName}</TableCell>
                    <TableCell>{row.batch.batchCode}</TableCell>
                    <TableCell align="right">
                      {formatNumber.format(row.batch.remainingQty)} {row.unit}
                    </TableCell>
                    <TableCell align="right">
                      <StatusChip label={`Expired +${row.daysPastExpiry}d`} color="error" />
                    </TableCell>
                  </TableRow>
                ))}
                {stockAlerts.nearExpiry.slice(0, 1).map((row) => (
                  <TableRow
                    key={row.batch.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/stock?batchId=${encodeURIComponent(row.batch.id)}`)}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{row.itemName}</TableCell>
                    <TableCell>{row.batch.batchCode}</TableCell>
                    <TableCell align="right">
                      {formatNumber.format(row.batch.remainingQty)} {row.unit}
                    </TableCell>
                    <TableCell align="right">
                      <StatusChip label={`Near expiry (${row.daysToExpiry}d)`} color="warning" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </Box>
      </Stack>
    </SectionCard>
  );

  const feedbackWidget = (
    <SectionCard
      title="Feedback Health"
      actions={
        <Button size="small" onClick={() => router.push('/feedback')} aria-label="Open feedback module">
          Open feedback
        </Button>
      }
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip
            label={`Avg satisfaction (week): ${feedbackSummary.avgSatisfaction.toFixed(1)} / 5`}
            color={feedbackSummary.avgSatisfaction <= 2.6 ? 'warning' : 'info'}
          />
          <Typography variant="caption" color="text.secondary">
            {feedbackSummary.weekCount} entry(ies)
          </Typography>
        </Stack>

        <TableShell title="Lowest-rated items (week)">
          <Table size="small" aria-label="Low rated items table">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Avg</TableCell>
                <TableCell align="right">Count</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {feedbackSummary.lowItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      No low-rated items detected in the current week range.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                feedbackSummary.lowItems.map((row) => (
                  <TableRow
                    key={row.menuItemId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/feedback?menuItemId=${encodeURIComponent(row.menuItemId)}`)}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{row.menuItemName}</TableCell>
                    <TableCell align="right">{row.avgSatisfaction.toFixed(1)}</TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableShell>
      </Stack>
    </SectionCard>
  );

  const recommendationsWidget = (
    <SectionCard
      title="Recommendations (Top 3)"
      actions={
        <Button size="small" onClick={() => router.push('/recommendations')} aria-label="Open recommendations module">
          View all
        </Button>
      }
    >
      <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {topRecommendations.map((r) => (
          <ListItemButton key={r.id} onClick={() => router.push('/recommendations')} sx={{ borderRadius: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <StatusChip label={r.severity.toUpperCase()} color={toRecommendationChipColor(r.severity)} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                  {r.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {r.rationale}
                </Typography>
              </Box>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </SectionCard>
  );

  const recentRequestsWidget = (
    <SectionCard
      title="Recent Requests"
      actions={
        <Button size="small" onClick={() => router.push('/requests')} aria-label="Open requests module">
          Open requests
        </Button>
      }
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip
            label={`${recentRequests.pendingCount} pending`}
            color={recentRequests.pendingCount > 0 ? 'warning' : 'default'}
          />
          <Typography variant="caption" color="text.secondary">
            Includes requested, approved, and partially issued
          </Typography>
        </Stack>

        <Table size="small" aria-label="Recent requests table">
          <TableHead>
            <TableRow>
              <TableCell>Request</TableCell>
              <TableCell>Item</TableCell>
              <TableCell align="right">Requested</TableCell>
              <TableCell align="right">Issued</TableCell>
              <TableCell align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentRequests.sorted.map((r) => (
              <TableRow
                key={r.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => router.push(`/requests?requestId=${encodeURIComponent(r.id)}`)}
              >
                <TableCell sx={{ fontWeight: 800 }}>{r.requestNo}</TableCell>
                <TableCell>{r.itemName}</TableCell>
                <TableCell align="right">
                  {formatNumber.format(r.requestedQty)} {r.unit}
                </TableCell>
                <TableCell align="right">
                  {formatNumber.format(r.issuedQty)} {r.unit}
                </TableCell>
                <TableCell align="right">
                  <StatusChip label={r.status} color={toRequestStatusChipColor(r.status)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </SectionCard>
  );

  const utilitiesWidget = (
    <SectionCard
      title="Utilities Summary"
      actions={
        <Button
          size="small"
          onClick={() => router.push(`/waste-utilities?date=${encodeURIComponent(asOfDate)}`)}
          aria-label="Open waste and utilities module"
        >
          Open module
        </Button>
      }
    >
      <Stack spacing={1}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard label="Electricity" value={`${utilitiesSummary.totals.Electricity.toFixed(0)} kWh`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard label="Water" value={`${utilitiesSummary.totals.Water.toFixed(1)} KL`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MetricCard label="LPG" value={`${utilitiesSummary.totals.LPG.toFixed(0)} kg`} />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip
            label={
              utilitiesSummary.latestSpikeDate
                ? `Electricity spike detected: ${formatShortDate(utilitiesSummary.latestSpikeDate)}`
                : 'No electricity spikes detected in range'
            }
            color={utilitiesSummary.latestSpikeDate ? 'warning' : 'default'}
          />
          <Typography variant="caption" color="text.secondary">
            Spike rule: ≥1.35× baseline (lookback 7 days)
          </Typography>
        </Stack>

        <Box sx={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={utilitiesSummary.electricitySeries} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
              <CartesianGrid stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="dateLabel" tickLine={false} axisLine={{ stroke: theme.palette.divider }} />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: theme.palette.divider }}
                width={38}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [`${value ?? 0} kWh`, 'Electricity']}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke={theme.palette.info.main}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </SectionCard>
  );

  const widgets: Record<WidgetKey, { size: { xs: number; md?: number; lg?: number }; element: React.ReactNode }> = {
    kpis: { size: { xs: 12 }, element: kpisWidget },
    alerts: { size: { xs: 12, md: 6 }, element: alertsWidget },
    dailyWaste: { size: { xs: 12, md: 6 }, element: dailyWasteWidget },
    weeklyWaste: { size: { xs: 12, md: 6 }, element: weeklyWasteWidget },
    sessionWaste: { size: { xs: 12, md: 6 }, element: sessionWasteWidget },
    menuLeftovers: { size: { xs: 12, md: 6 }, element: menuLeftoversWidget },
    matrix: { size: { xs: 12 }, element: matrixWidget },
    stockRisk: { size: { xs: 12, md: 6 }, element: stockRiskWidget },
    feedback: { size: { xs: 12, md: 6 }, element: feedbackWidget },
    recommendations: { size: { xs: 12, md: 6 }, element: recommendationsWidget },
    recentRequests: { size: { xs: 12, md: 6 }, element: recentRequestsWidget },
    utilities: { size: { xs: 12, md: 6 }, element: utilitiesWidget },
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={dashboardSubtitle}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            <Chip label={role} size="small" variant="outlined" sx={{ fontWeight: 700 }} />

            {dashboardCtas.map((cta) => (
              <Button
                key={cta.href}
                size="small"
                variant={cta.variant ?? 'text'}
                onClick={() => router.push(cta.href)}
              >
                {cta.label}
              </Button>
            ))}

            <Button
              size="small"
              onClick={() => {
                regenerateRecommendations();
                regenerateNotifications();
              }}
            >
              Refresh signals
            </Button>
            <Button size="small" variant="outlined" onClick={() => resetDashboard()}>
              Reset filters
            </Button>
          </Stack>
        }
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
            <InputLabel id="dashboard-session-label">Session</InputLabel>
            <Select
              labelId="dashboard-session-label"
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
          {widgetOrder.map((key) => (
            <Grid key={key} size={widgets[key].size}>
              {widgets[key].element}
            </Grid>
          ))}
        </Grid>
      </Stack>
    </>
  );
}
