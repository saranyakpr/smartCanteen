'use client';

import * as React from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

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
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { X } from 'lucide-react';

import { FilterBar } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { addDaysISODate, getBatchesFEFOSorted } from '@/lib/analytics';
import { buildCsv, downloadCsv, type CsvColumn } from '@/lib/exports/csv';
import { computeStockRequirementsFromKitchenPlans } from '@/lib/recipes';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useStockStore } from '@/stores/useStockStore';

import type { ISODate, Session } from '@/types/common';
import type { RequisitionRequest, RequestStatus } from '@/types/request';
import type { StockBatch, StockItem } from '@/types/stock';

type QueueView = 'all' | 'pending';

const SESSIONS: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN');

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function toRequestStatusChipColor(status: RequestStatus) {
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

function isExpired(batch: StockBatch, asOfDate: ISODate): boolean {
  if (!batch.expiryDate) return false;
  return batch.expiryDate < asOfDate;
}

type AllocationPreview = {
  availableQty: number;
  allocations: Array<{ batchId: string; batchCode: string; qty: number; expiryDate: ISODate | null; daysToExpiry: number | null }>;
  isFullyIssuable: boolean;
};

function buildIssuePreview(params: {
  batches: StockBatch[];
  requestedQty: number;
  asOfDate: ISODate;
}): AllocationPreview {
  const { batches, requestedQty, asOfDate } = params;
  const req = Math.max(0, requestedQty);
  let remaining = req;
  const allocations: AllocationPreview['allocations'] = [];

  const eligible = batches.filter((b) => b.remainingQty > 0 && !isExpired(b, asOfDate));
  const availableQty = eligible.reduce((sum, b) => sum + b.remainingQty, 0);

  for (const batch of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remainingQty, remaining);
    if (take <= 0) continue;
    allocations.push({
      batchId: batch.id,
      batchCode: batch.batchCode,
      qty: take,
      expiryDate: batch.expiryDate,
      daysToExpiry: batch.expiryDate ? differenceInCalendarDays(parseISO(batch.expiryDate), parseISO(asOfDate)) : null,
    });
    remaining -= take;
  }

  return { availableQty, allocations, isFullyIssuable: remaining <= 0 };
}

function RequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();

  const role = useRoleStore((s) => s.role);
  const actorLabel = `${role} (Demo User)`;

  const asOfDate = useDashboardStore((s) => s.asOfDate);

  const stockItems = useStockStore((s) => s.stockItems);
  const stockBatches = useStockStore((s) => s.stockBatches);

  const requests = useRequestStore((s) => s.requests);
  const issueEvents = useRequestStore((s) => s.issueEvents);
  const returnEvents = useRequestStore((s) => s.returnEvents);
  const createRequest = useRequestStore((s) => s.createRequest);
  const createRequestGroup = useRequestStore((s) => s.createRequestGroup);
  const approveRequest = useRequestStore((s) => s.approveRequest);
  const rejectRequest = useRequestStore((s) => s.rejectRequest);
  const issueRequestPartial = useRequestStore((s) => s.issueRequestPartial);
  const returnIssuedStock = useRequestStore((s) => s.returnIssuedStock);
  const closeRequest = useRequestStore((s) => s.closeRequest);

  const menuItems = useMenuStore((s) => s.menuItems);
  const kitchenPlans = useMenuStore((s) => s.kitchenPlans);

  const itemById = React.useMemo(() => new Map(stockItems.map((i) => [i.id, i])), [stockItems]);
  const batchById = React.useMemo(() => new Map(stockBatches.map((b) => [b.id, b])), [stockBatches]);
  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  const viewParam = (searchParams.get('view') as QueueView | null) ?? null;
  const requestIdParam = searchParams.get('requestId');

  const [queueView, setQueueView] = React.useState<QueueView>(viewParam === 'pending' ? 'pending' : 'all');
  React.useEffect(() => {
    if (!viewParam) return;
    setQueueView(viewParam === 'pending' ? 'pending' : 'all');
  }, [viewParam]);

  const [activeRequestId, setActiveRequestId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!requestIdParam) return;
    const r = requests.find((x) => x.id === requestIdParam);
    if (r) setActiveRequestId(r.id);
  }, [requestIdParam, requests]);

  const activeRequest = React.useMemo(() => {
    if (!activeRequestId) return null;
    return requests.find((r) => r.id === activeRequestId) ?? null;
  }, [activeRequestId, requests]);

  const activeItem = React.useMemo(() => {
    if (!activeRequest) return null;
    return itemById.get(activeRequest.itemId) ?? null;
  }, [activeRequest, itemById]);

  const activeBatches = React.useMemo(() => {
    if (!activeRequest) return [];
    return getBatchesFEFOSorted(stockBatches, activeRequest.itemId);
  }, [activeRequest, stockBatches]);

  const activeIssueEvents = React.useMemo(() => {
    if (!activeRequest) return [];
    return issueEvents
      .filter((e) => e.requestId === activeRequest.id)
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [activeRequest, issueEvents]);

  const activeReturnEvents = React.useMemo(() => {
    if (!activeRequest) return [];
    return returnEvents
      .filter((e) => e.requestId === activeRequest.id)
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [activeRequest, returnEvents]);

  const activeReturnedQty = React.useMemo(() => {
    return activeReturnEvents.reduce((sum, e) => sum + e.returnedQty, 0);
  }, [activeReturnEvents]);

  const pendingRequests = React.useMemo(() => {
    const list = requests.slice().sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.requestNo.localeCompare(a.requestNo);
    });
    if (queueView !== 'pending') return list;
    return list.filter((r) => ['Requested', 'Approved', 'Partially Issued'].includes(r.status));
  }, [queueView, requests]);

  const exportQueueCsv = React.useCallback(() => {
    type Row = {
      requestNo: string;
      date: ISODate;
      item: string;
      urgency: string;
      requestedQty: number;
      issuedQty: number;
      pendingQty: number;
      unit: string;
      status: string;
      requestedBy: string;
    };

    const rows: Row[] = pendingRequests.map((r) => ({
      requestNo: r.requestNo,
      date: r.date,
      item: itemById.get(r.itemId)?.name ?? r.itemId,
      urgency: r.urgency,
      requestedQty: r.requestedQty,
      issuedQty: r.issuedQty,
      pendingQty: Math.max(0, r.requestedQty - r.issuedQty),
      unit: r.unit,
      status: r.status,
      requestedBy: r.requestedByLabel,
    }));

    const columns: Array<CsvColumn<Row>> = [
      { key: 'requestNo', label: 'RequestNo' },
      { key: 'date', label: 'Date' },
      { key: 'item', label: 'Item' },
      { key: 'urgency', label: 'Urgency' },
      { key: 'requestedQty', label: 'RequestedQty' },
      { key: 'issuedQty', label: 'IssuedQty' },
      { key: 'pendingQty', label: 'PendingQty' },
      { key: 'unit', label: 'Unit' },
      { key: 'status', label: 'Status' },
      { key: 'requestedBy', label: 'RequestedBy' },
    ];

    const csv = buildCsv(columns, rows);
    downloadCsv({ filename: `requests_queue_${queueView}_${asOfDate}`, csv });
  }, [asOfDate, itemById, pendingRequests, queueView]);

  const exportIssueHistoryCsv = React.useCallback(() => {
    type Row = {
      occurredAt: string;
      requestNo: string;
      item: string;
      issuedQty: number;
      unit: string;
      issuedBy: string;
      remarks: string;
      allocations: string;
    };

    const sorted = issueEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 12);
    const reqById = new Map(requests.map((r) => [r.id, r]));
    const rows: Row[] = sorted.map((ev) => {
      const req = reqById.get(ev.requestId);
      const item = itemById.get(ev.itemId);
      const allocations = ev.allocations.map((a) => `${a.batchId}:${a.qty}`).join('; ');
      return {
        occurredAt: ev.occurredAt,
        requestNo: req?.requestNo ?? ev.requestId,
        item: item?.name ?? ev.itemId,
        issuedQty: ev.issuedQty,
        unit: ev.unit,
        issuedBy: ev.issuedByLabel,
        remarks: ev.remarks ?? '',
        allocations,
      };
    });

    const columns: Array<CsvColumn<Row>> = [
      { key: 'occurredAt', label: 'OccurredAt' },
      { key: 'requestNo', label: 'RequestNo' },
      { key: 'item', label: 'Item' },
      { key: 'issuedQty', label: 'IssuedQty' },
      { key: 'unit', label: 'Unit' },
      { key: 'issuedBy', label: 'IssuedBy' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'allocations', label: 'Allocations' },
    ];

    const csv = buildCsv(columns, rows);
    downloadCsv({ filename: `issue_history_${asOfDate}`, csv });
  }, [asOfDate, issueEvents, itemById, requests]);

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const [planDate, setPlanDate] = React.useState<ISODate>(addDaysISODate(asOfDate, 1));
  const [planSession, setPlanSession] = React.useState<Session | 'All'>('All');
  const [planUrgency, setPlanUrgency] = React.useState<RequisitionRequest['urgency']>('Normal');
  const [planRemarks, setPlanRemarks] = React.useState('');

  React.useEffect(() => setPlanDate(addDaysISODate(asOfDate, 1)), [asOfDate]);

  const plansForRequest = React.useMemo(() => {
    return kitchenPlans
      .filter((p) => p.date === planDate && (planSession === 'All' || p.session === planSession))
      .slice()
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const aRank = SESSIONS.indexOf(a.session);
        const bRank = SESSIONS.indexOf(b.session);
        return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank);
      });
  }, [kitchenPlans, planDate, planSession]);

  const planRequirements = React.useMemo(
    () => computeStockRequirementsFromKitchenPlans(plansForRequest),
    [plansForRequest],
  );

  const [formDate, setFormDate] = React.useState<ISODate>(asOfDate);
  const [formItemId, setFormItemId] = React.useState<StockItem['id']>(stockItems[0]?.id ?? 'si_rice');
  const [formRequestedQty, setFormRequestedQty] = React.useState('');
  const [formUrgency, setFormUrgency] = React.useState<RequisitionRequest['urgency']>('Normal');
  const [formRemarks, setFormRemarks] = React.useState('');

  React.useEffect(() => setFormDate(asOfDate), [asOfDate]);

  React.useEffect(() => {
    if (stockItems.length === 0) return;
    if (itemById.has(formItemId)) return;
    setFormItemId(stockItems[0]?.id ?? 'si_rice');
  }, [formItemId, itemById, stockItems]);

  const formItem = itemById.get(formItemId);
  const requestFormErrors: string[] = [];
  if (!formDate) requestFormErrors.push('Date is required.');
  if (!formItem) requestFormErrors.push('Item is required.');
  if (formRequestedQty.trim().length === 0) requestFormErrors.push('Requested quantity is required.');
  else if (!(Number.isFinite(Number(formRequestedQty)) && Number(formRequestedQty) > 0))
    requestFormErrors.push('Requested quantity must be a positive number.');

  const [actionApproveNote, setActionApproveNote] = React.useState('');
  const [actionRejectNote, setActionRejectNote] = React.useState('');
  const [actionCloseNote, setActionCloseNote] = React.useState('');

  const [issueQty, setIssueQty] = React.useState('');
  const [issueAsOfDate, setIssueAsOfDate] = React.useState<ISODate>(asOfDate);
  const [issueRemarks, setIssueRemarks] = React.useState('');

  React.useEffect(() => setIssueAsOfDate(asOfDate), [asOfDate]);

  const [returnQty, setReturnQty] = React.useState('');
  const [returnAsOfDate, setReturnAsOfDate] = React.useState<ISODate>(asOfDate);
  const [returnRemarks, setReturnRemarks] = React.useState('');

  React.useEffect(() => setReturnAsOfDate(asOfDate), [asOfDate]);

  React.useEffect(() => {
    if (!activeRequest) return;
    const pendingQty = Math.max(0, activeRequest.requestedQty - activeRequest.issuedQty);
    setIssueQty((current) => {
      const currentValue = Number(current);
      if (!Number.isFinite(currentValue) || currentValue <= 0 || currentValue > pendingQty) {
        return pendingQty > 0 ? String(pendingQty) : '';
      }
      return current;
    });
  }, [activeRequest]);

  React.useEffect(() => {
    setIssueRemarks('');
    setReturnRemarks('');
    setReturnQty('');
    setActionApproveNote('');
    setActionRejectNote('');
    setActionCloseNote('');
  }, [activeRequestId]);

  const issueErrors: string[] = [];
  if (!activeRequest) issueErrors.push('No request selected.');
  if (activeRequest && !['Approved', 'Partially Issued'].includes(activeRequest.status)) {
    issueErrors.push(`Request is not issuable in status: ${activeRequest.status}.`);
  }
  const pendingQtyForActive = activeRequest ? Math.max(0, activeRequest.requestedQty - activeRequest.issuedQty) : 0;
  if (issueQty.trim().length === 0) issueErrors.push('Issue quantity is required.');
  else if (!(Number.isFinite(Number(issueQty)) && Number(issueQty) > 0)) issueErrors.push('Issue quantity must be a positive number.');
  else if (activeRequest && Number(issueQty) > pendingQtyForActive)
    issueErrors.push(`Issue quantity must be ≤ pending quantity (${pendingQtyForActive}).`);

  const returnErrors: string[] = [];
  const returnableQtyForActive = activeRequest ? Math.max(0, activeRequest.issuedQty - activeReturnedQty) : 0;
  if (!activeRequest) returnErrors.push('No request selected.');
  if (activeRequest && !['Partially Issued', 'Issued', 'Closed'].includes(activeRequest.status)) {
    returnErrors.push(`Returns are not allowed in status: ${activeRequest.status}.`);
  }
  if (activeRequest && returnableQtyForActive <= 0) returnErrors.push('No issued quantity available to return.');
  if (returnQty.trim().length === 0) returnErrors.push('Return quantity is required.');
  else if (!(Number.isFinite(Number(returnQty)) && Number(returnQty) > 0)) returnErrors.push('Return quantity must be a positive number.');
  else if (activeRequest && Number(returnQty) > returnableQtyForActive)
    returnErrors.push(`Return quantity must be ≤ returnable quantity (${returnableQtyForActive}).`);

  const issuePreview = React.useMemo(() => {
    if (!activeRequest) return null;
    const qty = Number(issueQty);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return buildIssuePreview({ batches: activeBatches, requestedQty: qty, asOfDate: issueAsOfDate });
  }, [activeBatches, activeRequest, issueAsOfDate, issueQty]);

  const openRequestDrawer = (requestId: string) => {
    setActiveRequestId(requestId);
    const params = new URLSearchParams();
    if (queueView === 'pending') params.set('view', 'pending');
    params.set('requestId', requestId);
    router.replace(`/requests?${params.toString()}`);
  };

  const closeDrawer = () => {
    setActiveRequestId(null);
    const params = new URLSearchParams();
    if (queueView === 'pending') params.set('view', 'pending');
    const qs = params.toString();
    router.replace(qs ? `/requests?${qs}` : '/requests');
  };

  return (
    <>
      <PageHeader
        title="Requests & Issues"
        subtitle="Chef-to-store request workflow with approval, partial issue, issue, and closure."
      />

      <Stack spacing={2}>
        <FilterBar
          right={
            <Typography variant="caption" color="text.secondary">
              Acting role: {role}
            </Typography>
          }
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              View
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={queueView}
              onChange={(_, next: QueueView | null) => {
                if (!next) return;
                setQueueView(next);
                const params = new URLSearchParams();
                if (next === 'pending') params.set('view', 'pending');
                const qs = params.toString();
                router.replace(qs ? `/requests?${qs}` : '/requests');
              }}
              size="small"
              aria-label="Queue view"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="pending">Pending</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </FilterBar>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <SectionCard
                title="Generate Request (Kitchen Plan)"
                actions={
                  <Typography variant="caption" color="text.secondary">
                    Menu-based
                  </Typography>
                }
              >
                <Stack spacing={1.25}>
                  <TextField
                    size="small"
                    label="Plan date"
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value as ISODate)}
                    InputLabelProps={{ shrink: true }}
                  />

                  <FormControl size="small">
                    <InputLabel id="plan-session-label">Session</InputLabel>
                    <Select
                      labelId="plan-session-label"
                      label="Session"
                      value={planSession}
                      onChange={(e) => setPlanSession(e.target.value as Session | 'All')}
                    >
                      <MenuItem value="All">All sessions</MenuItem>
                      {SESSIONS.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small">
                    <InputLabel id="plan-urgency-label">Urgency</InputLabel>
                    <Select
                      labelId="plan-urgency-label"
                      label="Urgency"
                      value={planUrgency}
                      onChange={(e) => setPlanUrgency(e.target.value as RequisitionRequest['urgency'])}
                    >
                      <MenuItem value="Low">Low</MenuItem>
                      <MenuItem value="Normal">Normal</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    label="Remarks (optional)"
                    value={planRemarks}
                    onChange={(e) => setPlanRemarks(e.target.value)}
                    multiline
                    minRows={2}
                  />

                  {plansForRequest.length === 0 ? (
                    <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        No kitchen plan found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add a timetable entry in Menu & Consumption for {format(parseISO(planDate), 'EEE, dd MMM')}.
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Planned menu (timetable)
                      </Typography>
                      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                        {plansForRequest.map((p) => (
                          <Typography key={p.id} variant="caption" color="text.secondary">
                            {p.session}: {menuById.get(p.menuItemId)?.name ?? p.menuItemId} • {formatNumber(p.plannedQty)} plates
                          </Typography>
                        ))}
                      </Stack>
                    </Alert>
                  )}

                  {planRequirements.missingMenuItemIds.length > 0 ? (
                    <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Missing recipes
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add recipes for: {planRequirements.missingMenuItemIds.join(', ')}.
                      </Typography>
                    </Alert>
                  ) : null}

                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    <Table size="small" aria-label="Kitchen plan ingredient requirements">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {planRequirements.requirements.map((r) => {
                          const item = itemById.get(r.itemId);
                          return (
                            <TableRow key={r.itemId}>
                              <TableCell>{item?.name ?? r.itemId}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {formatNumber(r.qty)} {item?.unit ?? '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {planRequirements.requirements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2}>
                              <Typography variant="body2" color="text.secondary">
                                No ingredients calculated for this selection.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      disabled={
                        plansForRequest.length === 0 ||
                        planRequirements.requirements.length === 0 ||
                        planRequirements.missingMenuItemIds.length > 0
                      }
                      onClick={() => {
                        try {
                          const sessionLabel = planSession === 'All' ? 'All sessions' : planSession;
                          const defaultRemarks = `Generated from kitchen plan (${planDate} • ${sessionLabel}).`;
                          const created = createRequestGroup({
                            date: planDate,
                            requestedByRole: role,
                            requestedByLabel: actorLabel,
                            urgency: planUrgency,
                            remarks: planRemarks.trim().length > 0 ? planRemarks.trim() : defaultRemarks,
                            lineItems: planRequirements.requirements.map((r) => ({ itemId: r.itemId, requestedQty: r.qty })),
                          });
                          setSnackbar({
                            open: true,
                            message: `Created ${created.requestNo} (${created.requests.length} items).`,
                            severity: 'success',
                          });
                          setPlanRemarks('');
                          openRequestDrawer(created.requests[0].id);
                        } catch {
                          setSnackbar({ open: true, message: 'Failed to generate request from kitchen plan.', severity: 'error' });
                        }
                      }}
                    >
                      Create Menu Request
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>

              {role !== 'Chef' ? (
                <SectionCard title="New Request (Manual)">
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label="Date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value as ISODate)}
                      InputLabelProps={{ shrink: true }}
                    />

                    <FormControl size="small">
                      <InputLabel id="request-item-label">Item</InputLabel>
                      <Select
                        labelId="request-item-label"
                        label="Item"
                        value={formItemId}
                        onChange={(e) => setFormItemId(e.target.value as StockItem['id'])}
                      >
                        {stockItems.map((i) => (
                          <MenuItem key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      label={`Requested Qty (${formItem?.unit ?? '—'})`}
                      type="number"
                      value={formRequestedQty}
                      onChange={(e) => setFormRequestedQty(e.target.value)}
                      inputProps={{ min: 0, step: 1 }}
                      error={requestFormErrors.length > 0}
                      helperText={requestFormErrors[0] ?? 'Enter the quantity requested from store.'}
                    />

                    <FormControl size="small">
                      <InputLabel id="request-urgency-label">Urgency</InputLabel>
                      <Select
                        labelId="request-urgency-label"
                        label="Urgency"
                        value={formUrgency}
                        onChange={(e) => setFormUrgency(e.target.value as RequisitionRequest['urgency'])}
                      >
                        <MenuItem value="Low">Low</MenuItem>
                        <MenuItem value="Normal">Normal</MenuItem>
                        <MenuItem value="High">High</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      label="Remarks (optional)"
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      multiline
                      minRows={2}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        disabled={requestFormErrors.length > 0}
                        onClick={() => {
                          if (requestFormErrors.length > 0 || !formItem) {
                            setSnackbar({ open: true, message: 'Fix validation errors before creating request.', severity: 'error' });
                            return;
                          }
                          try {
                            const created = createRequest({
                              date: formDate,
                              requestedByRole: role,
                              requestedByLabel: actorLabel,
                              itemId: formItem.id,
                              unit: formItem.unit,
                              requestedQty: Number(formRequestedQty),
                              urgency: formUrgency,
                              remarks: formRemarks.trim().length > 0 ? formRemarks.trim() : undefined,
                            });
                            setSnackbar({ open: true, message: `Request ${created.requestNo} created.`, severity: 'success' });
                            setFormRequestedQty('');
                            setFormRemarks('');
                            openRequestDrawer(created.id);
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to create request.', severity: 'error' });
                          }
                        }}
                      >
                        Create Request
                      </Button>
                    </Stack>

                    <Divider />

                    <Typography variant="caption" color="text.secondary">
                      Status transitions are enforced (Requested → Approved/Rejected → Issue → Close).
                    </Typography>
                  </Stack>
                </SectionCard>
              ) : (
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Chef workflow
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Chef requests are generated from the kitchen timetable (menu-based), not individual items.
                  </Typography>
                </Alert>
              )}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <SectionCard
              title="Request Queue"
              actions={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button size="small" variant="outlined" onClick={exportQueueCsv}>
                    Export CSV
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    {pendingRequests.length} requests
                  </Typography>
                </Stack>
              }
            >
              <Table size="small" aria-label="Request queue">
                <TableHead>
                  <TableRow>
                    <TableCell>Request</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Requested</TableCell>
                    <TableCell align="right">Issued</TableCell>
                    <TableCell align="right">Pending</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRequests.map((r) => {
                    const item = itemById.get(r.itemId);
                    const pending = Math.max(0, r.requestedQty - r.issuedQty);
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {r.requestNo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.urgency} • {r.requestedByLabel}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseISO(r.date), 'MMM d')}</TableCell>
                        <TableCell>{item?.name ?? r.itemId}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatNumber(r.requestedQty)} {r.unit}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatNumber(r.issuedQty)} {r.unit}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatNumber(pending)} {r.unit}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <StatusChip label={r.status} color={toRequestStatusChipColor(r.status)} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button size="small" onClick={() => openRequestDrawer(r.id)}>
                            Open
                          </Button>
                          {r.status === 'Requested' ? (
                            <Button
                              size="small"
                              onClick={() => {
                                try {
                                  approveRequest(r.id, actorLabel, 'Approved');
                                  setSnackbar({ open: true, message: `Request ${r.requestNo} approved.`, severity: 'success' });
                                } catch {
                                  setSnackbar({ open: true, message: 'Failed to approve request.', severity: 'error' });
                                }
                              }}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {r.status === 'Issued' ? (
                            <Button
                              size="small"
                              onClick={() => {
                                try {
                                  closeRequest(r.id, actorLabel, 'Closed');
                                  setSnackbar({ open: true, message: `Request ${r.requestNo} closed.`, severity: 'success' });
                                } catch {
                                  setSnackbar({ open: true, message: 'Failed to close request.', severity: 'error' });
                                }
                              }}
                            >
                              Close
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pendingRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary">
                          No requests found for this view.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionCard
              title="Issue History"
              actions={
                <Button size="small" variant="outlined" onClick={exportIssueHistoryCsv}>
                  Export CSV
                </Button>
              }
            >
              <Table size="small" aria-label="Issue history">
                <TableHead>
                  <TableRow>
                    <TableCell>Date/Time</TableCell>
                    <TableCell>Request</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Issued Qty</TableCell>
                    <TableCell>FEFO Allocations</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issueEvents
                    .slice()
                    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                    .slice(0, 12)
                    .map((ev) => {
                      const req = requests.find((r) => r.id === ev.requestId);
                      const item = itemById.get(ev.itemId);
                      return (
                        <TableRow key={ev.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {format(parseISO(ev.occurredAt), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {req ? (
                              <Box
                                component="button"
                                type="button"
                                onClick={() => openRequestDrawer(req.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  color: theme.palette.primary.main,
                                  fontWeight: 800,
                                }}
                                aria-label={`Open ${req.requestNo}`}
                              >
                                {req.requestNo}
                              </Box>
                            ) : (
                              ev.requestId
                            )}
                          </TableCell>
                          <TableCell>{item?.name ?? ev.itemId}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {formatNumber(ev.issuedQty)} {ev.unit}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              {ev.allocations.map((a) => {
                                const batch = batchById.get(a.batchId);
                                return (
                                  <Typography key={a.batchId} variant="caption" color="text.secondary">
                                    {batch?.batchCode ?? a.batchId}: {formatNumber(a.qty)} {ev.unit}
                                  </Typography>
                                );
                              })}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {ev.allocations[0] ? (
                              <Button
                                size="small"
                                onClick={() => router.push(`/stock?batchId=${encodeURIComponent(ev.allocations[0].batchId)}`)}
                              >
                                View stock
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {issueEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          No issues recorded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </SectionCard>
          </Grid>
        </Grid>
      </Stack>

      <Drawer
        anchor="right"
        open={Boolean(activeRequest)}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                {activeRequest?.requestNo ?? 'Request'}
              </Typography>
              {activeRequest ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <StatusChip label={activeRequest.status} color={toRequestStatusChipColor(activeRequest.status)} />
                  <Typography variant="caption" color="text.secondary">
                    {format(parseISO(activeRequest.date), 'EEE, dd MMM yyyy')}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
            <IconButton aria-label="Close" onClick={closeDrawer}>
              <X size={18} />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ p: 2 }}>
          {activeRequest && activeItem ? (
            <Stack spacing={2}>
              <SectionCard title="Request Summary">
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {activeItem.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Requested by: {activeRequest.requestedByLabel} ({activeRequest.requestedByRole})
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Requested
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {formatNumber(activeRequest.requestedQty)} {activeRequest.unit}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Issued
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {formatNumber(activeRequest.issuedQty)} {activeRequest.unit}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Pending
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {formatNumber(Math.max(0, activeRequest.requestedQty - activeRequest.issuedQty))} {activeRequest.unit}
                      </Typography>
                    </Grid>
                  </Grid>

                  {activeReturnedQty > 0 ? (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Returned
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {formatNumber(activeReturnedQty)} {activeRequest.unit}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Net issued
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {formatNumber(Math.max(0, activeRequest.issuedQty - activeReturnedQty))} {activeRequest.unit}
                        </Typography>
                      </Grid>
                    </Grid>
                  ) : null}

                  {activeRequest.remarks ? (
                    <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Remarks
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activeRequest.remarks}
                      </Typography>
                    </Alert>
                  ) : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => router.push(`/stock?itemId=${encodeURIComponent(activeItem.id)}`)}>
                      Open Stock
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Status Timeline">
                <Stack spacing={1}>
                  {activeRequest.timeline
                    .slice()
                    .sort((a, b) => a.at.localeCompare(b.at))
                    .map((ev) => (
                      <Box key={ev.id}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <StatusChip label={ev.status} color={toRequestStatusChipColor(ev.status)} />
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {format(parseISO(ev.at), 'MMM d, HH:mm')}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {ev.actorLabel}
                          {ev.note ? ` • ${ev.note}` : ''}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                      </Box>
                    ))}
                </Stack>
              </SectionCard>

              <SectionCard title="Issue Events (FEFO allocations)">
                {activeIssueEvents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No issues recorded for this request yet.
                  </Typography>
                ) : (
                  <Table size="small" aria-label="Issue events table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date/Time</TableCell>
                        <TableCell align="right">Issued</TableCell>
                        <TableCell>Allocations</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeIssueEvents.map((ev) => (
                        <TableRow key={ev.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {format(parseISO(ev.occurredAt), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {formatNumber(ev.issuedQty)} {ev.unit}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.25}>
                              {ev.allocations.map((a) => {
                                const batch = batchById.get(a.batchId);
                                return (
                                  <Typography key={a.batchId} variant="caption" color="text.secondary">
                                    {batch?.batchCode ?? a.batchId}: {formatNumber(a.qty)} {ev.unit}
                                  </Typography>
                                );
                              })}
                              {ev.remarks ? (
                                <Typography variant="caption" color="text.secondary">
                                  Note: {ev.remarks}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>

              <SectionCard title="Return Events (Back to store)">
                {activeReturnEvents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No returns recorded for this request yet.
                  </Typography>
                ) : (
                  <Table size="small" aria-label="Return events table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date/Time</TableCell>
                        <TableCell align="right">Returned</TableCell>
                        <TableCell>Allocations</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeReturnEvents.map((ev) => (
                        <TableRow key={ev.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {format(parseISO(ev.occurredAt), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {formatNumber(ev.returnedQty)} {ev.unit}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.25}>
                              {ev.allocations.map((a) => {
                                const batch = batchById.get(a.batchId);
                                return (
                                  <Typography key={a.batchId} variant="caption" color="text.secondary">
                                    {batch?.batchCode ?? a.batchId}: {formatNumber(a.qty)} {ev.unit}
                                  </Typography>
                                );
                              })}
                              {ev.remarks ? (
                                <Typography variant="caption" color="text.secondary">
                                  Note: {ev.remarks}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>

              {['Partially Issued', 'Issued', 'Closed'].includes(activeRequest.status) && activeRequest.issuedQty > 0 ? (
                <SectionCard
                  title="Actions (Return to store)"
                  actions={
                    <Typography variant="caption" color="text.secondary">
                      Returnable: {formatNumber(returnableQtyForActive)} {activeRequest.unit}
                    </Typography>
                  }
                >
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label={`Return Qty (${activeRequest.unit})`}
                      type="number"
                      value={returnQty}
                      onChange={(e) => setReturnQty(e.target.value)}
                      inputProps={{ min: 0, step: 1, max: returnableQtyForActive }}
                      error={returnErrors.length > 0}
                      helperText={returnErrors[0] ?? `Returnable quantity: ${formatNumber(returnableQtyForActive)} ${activeRequest.unit}`}
                    />
                    <TextField
                      size="small"
                      label="As of date"
                      type="date"
                      value={returnAsOfDate}
                      onChange={(e) => setReturnAsOfDate(e.target.value as ISODate)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      label="Remarks (optional)"
                      value={returnRemarks}
                      onChange={(e) => setReturnRemarks(e.target.value)}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        disabled={returnErrors.length > 0}
                        onClick={() => {
                          if (returnErrors.length > 0) {
                            setSnackbar({ open: true, message: 'Fix validation errors before returning.', severity: 'error' });
                            return;
                          }
                          try {
                            const result = returnIssuedStock({
                              requestId: activeRequest.id,
                              qty: Number(returnQty),
                              asOfDate: returnAsOfDate,
                              returnedByLabel: actorLabel,
                              remarks: returnRemarks.trim().length > 0 ? returnRemarks.trim() : undefined,
                            });
                            setSnackbar({
                              open: true,
                              message: `Returned ${formatNumber(result.returnedQty)} ${activeRequest.unit} back to store.`,
                              severity: 'success',
                            });
                            setReturnQty('');
                            setReturnRemarks('');
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to return stock to store.', severity: 'error' });
                          }
                        }}
                      >
                        Return to Store
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              ) : null}

              {activeRequest.status === 'Requested' ? (
                <SectionCard title="Actions (Approval)">
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label="Approval note (optional)"
                      value={actionApproveNote}
                      onChange={(e) => setActionApproveNote(e.target.value)}
                    />
                    <TextField
                      size="small"
                      label="Rejection note (required)"
                      value={actionRejectNote}
                      onChange={(e) => setActionRejectNote(e.target.value)}
                      placeholder="Explain why the request is rejected."
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (actionRejectNote.trim().length === 0) {
                            setSnackbar({ open: true, message: 'Rejection note is required.', severity: 'error' });
                            return;
                          }
                          try {
                            rejectRequest(activeRequest.id, actorLabel, actionRejectNote.trim());
                            setSnackbar({ open: true, message: `${activeRequest.requestNo} rejected.`, severity: 'success' });
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to reject request.', severity: 'error' });
                          }
                        }}
                        color="error"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          try {
                            approveRequest(activeRequest.id, actorLabel, actionApproveNote.trim().length > 0 ? actionApproveNote.trim() : undefined);
                            setSnackbar({ open: true, message: `${activeRequest.requestNo} approved.`, severity: 'success' });
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to approve request.', severity: 'error' });
                          }
                        }}
                      >
                        Approve
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              ) : null}

              {activeRequest.status === 'Approved' || activeRequest.status === 'Partially Issued' ? (
                <SectionCard
                  title="Actions (Issue)"
                  actions={
                    <Typography variant="caption" color="text.secondary">
                      FEFO applies; expired batches excluded.
                    </Typography>
                  }
                >
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label={`Issue Qty (${activeRequest.unit})`}
                      type="number"
                      value={issueQty}
                      onChange={(e) => setIssueQty(e.target.value)}
                      inputProps={{ min: 0, step: 1, max: pendingQtyForActive }}
                      error={issueErrors.length > 0}
                      helperText={issueErrors[0] ?? `Pending quantity: ${formatNumber(pendingQtyForActive)} ${activeRequest.unit}`}
                    />
                    <TextField
                      size="small"
                      label="As of date"
                      type="date"
                      value={issueAsOfDate}
                      onChange={(e) => setIssueAsOfDate(e.target.value as ISODate)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      label="Issue remarks (optional)"
                      value={issueRemarks}
                      onChange={(e) => setIssueRemarks(e.target.value)}
                      multiline
                      minRows={2}
                    />

                    {issuePreview ? (
                      <Alert severity={issuePreview.isFullyIssuable ? 'info' : 'warning'} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          FEFO allocation preview
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Eligible stock (non-expired): {formatNumber(issuePreview.availableQty)} {activeRequest.unit}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          {issuePreview.allocations.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                              No eligible batches available for issue.
                            </Typography>
                          ) : (
                            <Stack spacing={0.75}>
                              {issuePreview.allocations.map((a) => (
                                <Box key={a.batchId}>
                                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                    {a.batchCode}: {formatNumber(a.qty)} {activeRequest.unit}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Expiry: {a.expiryDate ?? '—'}
                                    {a.daysToExpiry !== null ? ` (${a.daysToExpiry}d)` : ''}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </Box>
                      </Alert>
                    ) : null}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        disabled={issueErrors.length > 0}
                        onClick={() => {
                          if (issueErrors.length > 0) {
                            setSnackbar({ open: true, message: 'Fix validation errors before issuing.', severity: 'error' });
                            return;
                          }
                          try {
                            const result = issueRequestPartial({
                              requestId: activeRequest.id,
                              qty: Number(issueQty),
                              asOfDate: issueAsOfDate,
                              issuedByLabel: actorLabel,
                              remarks: issueRemarks.trim().length > 0 ? issueRemarks.trim() : undefined,
                            });
                            setSnackbar({
                              open: true,
                              message: `Issued ${formatNumber(result.issuedQty)} ${activeRequest.unit}. Status: ${result.statusAfter}.`,
                              severity: 'success',
                            });
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to issue against request.', severity: 'error' });
                          }
                        }}
                      >
                        Issue (Partial allowed)
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              ) : null}

              {activeRequest.status === 'Issued' ? (
                <SectionCard title="Actions (Close)">
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label="Closure note (optional)"
                      value={actionCloseNote}
                      onChange={(e) => setActionCloseNote(e.target.value)}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        onClick={() => {
                          try {
                            closeRequest(activeRequest.id, actorLabel, actionCloseNote.trim().length > 0 ? actionCloseNote.trim() : undefined);
                            setSnackbar({ open: true, message: `${activeRequest.requestNo} closed.`, severity: 'success' });
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to close request.', severity: 'error' });
                          }
                        }}
                      >
                        Close Request
                      </Button>
                    </Stack>
                  </Stack>
                </SectionCard>
              ) : null}

              {activeRequest.status === 'Rejected' ? (
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Rejected request
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No further actions are allowed for rejected requests.
                  </Typography>
                </Alert>
              ) : null}

              {activeRequest.status === 'Closed' ? (
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Closed request
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This request is completed and archived in the timeline.
                  </Typography>
                </Alert>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a request to view details and actions.
            </Typography>
          )}
        </Box>
      </Drawer>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default function RequestsPage() {
  return (
    <React.Suspense fallback={null}>
      <RequestsPageContent />
    </React.Suspense>
  );
}
