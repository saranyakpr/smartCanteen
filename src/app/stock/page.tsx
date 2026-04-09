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
  List,
  ListItemButton,
  ListItemText,
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
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { X } from 'lucide-react';

import { FilterBar } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  getBatchesFEFOSorted,
  getBatchesNearExpiry,
  getExpiredBatches,
  getItemsBelowReorder,
} from '@/lib/analytics';
import { buildCsv, downloadCsv, type CsvColumn } from '@/lib/exports/csv';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useStockStore } from '@/stores/useStockStore';

import type { ISODate } from '@/types/common';
import type { StockBatch, StockItem } from '@/types/stock';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN');

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function formatShortDate(date: ISODate): string {
  return format(parseISO(date), 'MMM d');
}

function isExpiredBatch(batch: StockBatch, asOfDate: ISODate): boolean {
  return Boolean(batch.expiryDate && batch.expiryDate < asOfDate && batch.remainingQty > 0);
}

function isNearExpiryBatch(batch: StockBatch, asOfDate: ISODate, daysThreshold: number): boolean {
  if (!batch.expiryDate) return false;
  if (batch.expiryDate < asOfDate) return false;
  if (batch.remainingQty <= 0) return false;
  const days = differenceInCalendarDays(parseISO(batch.expiryDate), parseISO(asOfDate));
  return days <= daysThreshold;
}

type IssueSuggestion = {
  requestedQty: number;
  availableQty: number;
  allocations: Array<{ batchId: string; batchCode: string; qty: number; expiryDate: ISODate | null }>;
  isFullyIssuable: boolean;
};

function suggestIssueFEFO(params: {
  batches: StockBatch[];
  requestedQty: number;
  asOfDate: ISODate;
}): IssueSuggestion {
  const { batches, requestedQty, asOfDate } = params;
  const req = Math.max(0, requestedQty);
  let remaining = req;
  const allocations: IssueSuggestion['allocations'] = [];

  const candidates = batches.filter((b) => b.remainingQty > 0 && !isExpiredBatch(b, asOfDate));
  const availableQty = candidates.reduce((sum, b) => sum + b.remainingQty, 0);

  for (const batch of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remainingQty, remaining);
    if (take <= 0) continue;
    allocations.push({ batchId: batch.id, batchCode: batch.batchCode, qty: take, expiryDate: batch.expiryDate });
    remaining -= take;
  }

  return { requestedQty: req, availableQty, allocations, isFullyIssuable: remaining <= 0 };
}

function StockPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();

  const asOfDate = useDashboardStore((s) => s.asOfDate);

  const stockItems = useStockStore((s) => s.stockItems);
  const stockBatches = useStockStore((s) => s.stockBatches);
  const stockTransactions = useStockStore((s) => s.stockTransactions);
  const receiveStock = useStockStore((s) => s.receiveStock);
  const issueStockFEFO = useStockStore((s) => s.issueStockFEFO);
  const adjustStock = useStockStore((s) => s.adjustStock);

  const [activeItemId, setActiveItemId] = React.useState<StockItem['id'] | null>(null);
  const [highlightBatchId, setHighlightBatchId] = React.useState<StockBatch['id'] | null>(null);

  React.useEffect(() => {
    const batchId = searchParams.get('batchId');
    const itemId = searchParams.get('itemId');

    if (batchId) {
      const batch = stockBatches.find((b) => b.id === batchId);
      if (batch) {
        setActiveItemId(batch.itemId);
        setHighlightBatchId(batch.id);
        return;
      }
    }

    if (itemId) {
      const item = stockItems.find((i) => i.id === itemId);
      if (item) {
        setActiveItemId(item.id);
        setHighlightBatchId(null);
      }
    }
  }, [searchParams, stockBatches, stockItems]);

  const itemById = React.useMemo(() => new Map(stockItems.map((i) => [i.id, i])), [stockItems]);
  const batchById = React.useMemo(() => new Map(stockBatches.map((b) => [b.id, b])), [stockBatches]);

  const onHandByItemId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stockItems) {
      const onHand = stockBatches.filter((b) => b.itemId === item.id).reduce((sum, b) => sum + b.remainingQty, 0);
      map.set(item.id, onHand);
    }
    return map;
  }, [stockBatches, stockItems]);

  const belowReorder = React.useMemo(() => getItemsBelowReorder(stockItems, stockBatches), [stockBatches, stockItems]);
  const nearExpiry = React.useMemo(() => getBatchesNearExpiry(stockBatches, asOfDate, 2), [asOfDate, stockBatches]);
  const expired = React.useMemo(() => getExpiredBatches(stockBatches, asOfDate), [asOfDate, stockBatches]);

  const nearExpiryByItemId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of nearExpiry) {
      map.set(row.batch.itemId, (map.get(row.batch.itemId) ?? 0) + 1);
    }
    return map;
  }, [nearExpiry]);

  const expiredByItemId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expired) {
      map.set(row.batch.itemId, (map.get(row.batch.itemId) ?? 0) + 1);
    }
    return map;
  }, [expired]);

  const activeItem = React.useMemo(() => {
    if (!activeItemId) return null;
    return stockItems.find((i) => i.id === activeItemId) ?? null;
  }, [activeItemId, stockItems]);

  const activeItemBatches = React.useMemo(() => {
    if (!activeItem) return [];
    return getBatchesFEFOSorted(stockBatches, activeItem.id);
  }, [activeItem, stockBatches]);

  const recentTransactions = React.useMemo(() => {
    return stockTransactions
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 20);
  }, [stockTransactions]);

  const exportCurrentStockCsv = React.useCallback(() => {
    type Row = {
      itemName: string;
      category: string;
      unit: string;
      onHand: number;
      reorderLevel: number;
      belowReorder: boolean;
      nearExpiryBatches: number;
      expiredBatches: number;
    };

    const rows: Row[] = stockItems.map((item) => {
      const onHand = onHandByItemId.get(item.id) ?? 0;
      const near = nearExpiryByItemId.get(item.id) ?? 0;
      const exp = expiredByItemId.get(item.id) ?? 0;
      return {
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        onHand,
        reorderLevel: item.reorderLevel,
        belowReorder: onHand < item.reorderLevel,
        nearExpiryBatches: near,
        expiredBatches: exp,
      };
    });

    const columns: Array<CsvColumn<Row>> = [
      { key: 'itemName', label: 'Item' },
      { key: 'category', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'onHand', label: 'OnHandQty' },
      { key: 'reorderLevel', label: 'ReorderLevel' },
      { key: 'belowReorder', label: 'BelowReorder' },
      { key: 'nearExpiryBatches', label: 'NearExpiryBatches(<=2d)' },
      { key: 'expiredBatches', label: 'ExpiredBatches' },
    ];

    const csv = buildCsv(columns, rows);
    downloadCsv({ filename: `stock_current_${asOfDate}`, csv });
  }, [asOfDate, expiredByItemId, nearExpiryByItemId, onHandByItemId, stockItems]);

  const activeItemTransactions = React.useMemo(() => {
    if (!activeItem) return [];
    return stockTransactions
      .filter((t) => t.itemId === activeItem.id)
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 25);
  }, [activeItem, stockTransactions]);

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const closeDrawer = () => {
    setActiveItemId(null);
    setHighlightBatchId(null);
    router.replace('/stock');
  };

  const [issueQty, setIssueQty] = React.useState('');
  const [issueAsOfDate, setIssueAsOfDate] = React.useState<ISODate>(asOfDate);
  const [issueNotes, setIssueNotes] = React.useState('');

  React.useEffect(() => setIssueAsOfDate(asOfDate), [asOfDate]);

  const issueSuggestion = React.useMemo(() => {
    const requested = Number(issueQty);
    if (!activeItem) return null;
    if (!Number.isFinite(requested) || requested <= 0) return null;
    return suggestIssueFEFO({ batches: activeItemBatches, requestedQty: requested, asOfDate: issueAsOfDate });
  }, [activeItem, activeItemBatches, issueAsOfDate, issueQty]);

  const [receiptQty, setReceiptQty] = React.useState('');
  const [receiptDate, setReceiptDate] = React.useState<ISODate>(asOfDate);
  const [receiptExpiryDate, setReceiptExpiryDate] = React.useState<ISODate | ''>('');
  const [receiptBatchCode, setReceiptBatchCode] = React.useState('');
  const [receiptSupplier, setReceiptSupplier] = React.useState('');
  const [receiptNotes, setReceiptNotes] = React.useState('');

  React.useEffect(() => setReceiptDate(asOfDate), [asOfDate]);

  const [adjustBatchId, setAdjustBatchId] = React.useState<StockBatch['id'] | ''>('');
  const [adjustNewRemaining, setAdjustNewRemaining] = React.useState('');
  const [adjustNotes, setAdjustNotes] = React.useState('');

  React.useEffect(() => {
    if (!activeItem) {
      setAdjustBatchId('');
      setAdjustNewRemaining('');
      setAdjustNotes('');
      return;
    }
    if (highlightBatchId) {
      setAdjustBatchId(highlightBatchId);
      const batch = batchById.get(highlightBatchId);
      if (batch) setAdjustNewRemaining(String(batch.remainingQty));
    } else if (activeItemBatches[0]) {
      setAdjustBatchId(activeItemBatches[0].id);
      setAdjustNewRemaining(String(activeItemBatches[0].remainingQty));
    }
  }, [activeItem, activeItemBatches, batchById, highlightBatchId]);

  const activeAdjustBatch = React.useMemo(() => {
    if (!adjustBatchId) return null;
    return batchById.get(adjustBatchId) ?? null;
  }, [adjustBatchId, batchById]);

  return (
    <>
      <PageHeader
        title="Stock & Inventory"
        subtitle="Current stock, FEFO batches, receipts/issues, expiry and reorder risk, and variance."
      />

      <Stack spacing={2}>
        <FilterBar
          right={
            <Typography variant="caption" color="text.secondary">
              As of: {format(parseISO(asOfDate), 'EEE, dd MMM yyyy')}
            </Typography>
          }
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Reorder and expiry indicators use the dashboard “As of” date.
          </Typography>
        </FilterBar>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <SectionCard
              title="Current Stock"
              actions={
                <Button size="small" variant="outlined" onClick={exportCurrentStockCsv}>
                  Export CSV
                </Button>
              }
            >
              <Table size="small" aria-label="Current stock table">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">On Hand</TableCell>
                    <TableCell align="right">Reorder Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockItems.map((item) => {
                    const onHand = onHandByItemId.get(item.id) ?? 0;
                    const below = onHand < item.reorderLevel;
                    const near = nearExpiryByItemId.get(item.id) ?? 0;
                    const exp = expiredByItemId.get(item.id) ?? 0;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.unit}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatNumber(onHand)}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatNumber(item.reorderLevel)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {below ? <StatusChip label="Reorder" color="warning" /> : null}
                            {near > 0 ? <StatusChip label={`Near expiry (${near})`} color="warning" /> : null}
                            {exp > 0 ? <StatusChip label={`Expired (${exp})`} color="error" /> : null}
                            {!below && near === 0 && exp === 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                OK
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            size="small"
                            onClick={() => {
                              setActiveItemId(item.id);
                              setHighlightBatchId(null);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <SectionCard title="Reorder & Expiry Alerts">
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                    Reorder
                  </Typography>
                  {belowReorder.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No items below reorder level.
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {belowReorder.slice(0, 6).map((r) => (
                        <ListItemButton
                          key={r.itemId}
                          sx={{ borderRadius: 2, mb: 0.5 }}
                          onClick={() => {
                            setActiveItemId(r.itemId);
                            setHighlightBatchId(null);
                          }}
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.itemName}
                                </Typography>
                                <StatusChip label="Reorder" color="warning" />
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                On hand: {formatNumber(r.onHandQty)} {r.unit} • Reorder level: {formatNumber(r.reorderLevel)}
                              </Typography>
                            }
                            secondaryTypographyProps={{ component: 'div' }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                    Expiry
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Near expiry (≤ 2 days)
                      </Typography>
                      {nearExpiry.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          None.
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {nearExpiry.slice(0, 5).map((row) => {
                            const item = itemById.get(row.batch.itemId);
                            return (
                              <ListItemButton
                                key={row.batch.id}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                                onClick={() => {
                                  setActiveItemId(row.batch.itemId);
                                  setHighlightBatchId(row.batch.id);
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item?.name ?? row.batch.itemId}
                                      </Typography>
                                      <StatusChip label={`${row.daysToExpiry}d`} color="warning" />
                                    </Stack>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary">
                                      {row.batch.batchCode} • Remaining: {formatNumber(row.batch.remainingQty)} {item?.unit ?? 'kg'}
                                    </Typography>
                                  }
                                  secondaryTypographyProps={{ component: 'div' }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Expired
                      </Typography>
                      {expired.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          None.
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {expired.slice(0, 5).map((row) => {
                            const item = itemById.get(row.batch.itemId);
                            return (
                              <ListItemButton
                                key={row.batch.id}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                                onClick={() => {
                                  setActiveItemId(row.batch.itemId);
                                  setHighlightBatchId(row.batch.id);
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item?.name ?? row.batch.itemId}
                                      </Typography>
                                      <StatusChip label={`+${row.daysPastExpiry}d`} color="error" />
                                    </Stack>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary">
                                      {row.batch.batchCode} • Remaining: {formatNumber(row.batch.remainingQty)} {item?.unit ?? 'kg'}
                                    </Typography>
                                  }
                                  secondaryTypographyProps={{ component: 'div' }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      )}
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionCard title="Transactions Ledger (Recent)">
              <Table size="small" aria-label="Stock transactions ledger">
                <TableHead>
                  <TableRow>
                    <TableCell>Date/Time</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Ref</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTransactions.map((t) => {
                    const item = itemById.get(t.itemId);
                    const batch = t.batchId ? batchById.get(t.batchId) : null;
                    const qtyLabel = `${t.qty > 0 ? '+' : ''}${t.qty} ${t.unit}`;
                    return (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {format(parseISO(t.occurredAt), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <StatusChip
                            label={t.type}
                            color={t.type === 'Receipt' || t.type === 'Return' ? 'success' : t.type === 'Issue' ? 'info' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{item?.name ?? t.itemId}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{batch?.batchCode ?? (t.batchId ?? '—')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: t.qty < 0 ? theme.palette.text.primary : theme.palette.text.primary }}>
                            {qtyLabel}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {t.reference ? `${t.reference.kind}:${t.reference.id}` : '—'}
                        </TableCell>
                        <TableCell>{t.notes ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No transactions found.
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

      <Drawer anchor="right" open={Boolean(activeItem)} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                {activeItem?.name ?? 'Stock item'}
              </Typography>
              {activeItem ? (
                <Typography variant="caption" color="text.secondary">
                  On hand: {formatNumber(onHandByItemId.get(activeItem.id) ?? 0)} {activeItem.unit} • Reorder level:{' '}
                  {formatNumber(activeItem.reorderLevel)}
                </Typography>
              ) : null}
            </Box>
            <IconButton aria-label="Close" onClick={closeDrawer}>
              <X size={18} />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ p: 2 }}>
          {activeItem ? (
            <Stack spacing={2}>
              <SectionCard title="Batches (FEFO)">
                <Table size="small" aria-label="Stock batches FEFO table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch</TableCell>
                      <TableCell>Expiry</TableCell>
                      <TableCell align="right">Opening</TableCell>
                      <TableCell align="right">Closing</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeItemBatches.map((b, idx) => {
                      const expiredNow = isExpiredBatch(b, asOfDate);
                      const nearNow = isNearExpiryBatch(b, asOfDate, 2);
                      const daysToExpiry = b.expiryDate ? differenceInCalendarDays(parseISO(b.expiryDate), parseISO(asOfDate)) : null;
                      const isHighlighted = highlightBatchId === b.id;
                      return (
                        <TableRow key={b.id} hover selected={isHighlighted}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {b.batchCode}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              FEFO rank #{idx + 1}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {b.expiryDate ? (
                              <>
                                {formatShortDate(b.expiryDate)}
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {' '}
                                  ({daysToExpiry !== null ? `${daysToExpiry}d` : '—'})
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {formatNumber(b.receivedQty)} {activeItem.unit}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {formatNumber(b.remainingQty)} {activeItem.unit}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {expiredNow ? <StatusChip label="Expired" color="error" /> : null}
                              {!expiredNow && nearNow ? <StatusChip label="Near expiry" color="warning" /> : null}
                              {!expiredNow && !nearNow ? (
                                <Typography variant="caption" color="text.secondary">
                                  OK
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {activeItemBatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No batches found for this item.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </SectionCard>

              <SectionCard
                title="Issue Stock (FEFO enforced)"
                actions={<Typography variant="caption" color="text.secondary">Expired batches are excluded.</Typography>}
              >
                <Stack spacing={1.25}>
                  <TextField
                    size="small"
                    label={`Issue Qty (${activeItem.unit})`}
                    type="number"
                    value={issueQty}
                    onChange={(e) => setIssueQty(e.target.value)}
                    inputProps={{ min: 0, step: 1 }}
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
                    label="Notes (optional)"
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    multiline
                    minRows={2}
                  />

                  {issueSuggestion ? (
                    <Alert
                      severity={issueSuggestion.isFullyIssuable ? 'info' : 'warning'}
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        FEFO suggestion
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Available: {formatNumber(issueSuggestion.availableQty)} {activeItem.unit} • Requested: {formatNumber(issueSuggestion.requestedQty)} {activeItem.unit}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {issueSuggestion.allocations.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            No eligible batches (check expiry and remaining quantity).
                          </Typography>
                        ) : (
                          <Stack spacing={0.75}>
                            {issueSuggestion.allocations.map((a) => (
                              <Box key={a.batchId}>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {a.batchCode}: {formatNumber(a.qty)} {activeItem.unit}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Expiry: {a.expiryDate ?? '—'}
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
                      onClick={() => {
                        const qty = Number(issueQty);
                        if (!Number.isFinite(qty) || qty <= 0) {
                          setSnackbar({ open: true, message: 'Enter a valid issue quantity.', severity: 'error' });
                          return;
                        }
                        try {
                          const result = issueStockFEFO({
                            itemId: activeItem.id,
                            qty,
                            asOfDate: issueAsOfDate,
                            actorLabel: 'Store Manager',
                            reference: { kind: 'Manual', id: `issue_${issueAsOfDate}` },
                            notes: issueNotes.trim().length > 0 ? issueNotes.trim() : undefined,
                          });
                          setSnackbar({
                            open: true,
                            message: result.isFullyIssued
                              ? `Issued ${formatNumber(result.issuedQty)} ${activeItem.unit} (FEFO).`
                              : `Partially issued ${formatNumber(result.issuedQty)} ${activeItem.unit} (insufficient stock).`,
                            severity: result.isFullyIssued ? 'success' : 'error',
                          });
                          setIssueQty('');
                          setIssueNotes('');
                        } catch {
                          setSnackbar({ open: true, message: 'Failed to issue stock.', severity: 'error' });
                        }
                      }}
                    >
                      Issue Stock
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Receive Stock (Receipt)">
                <Stack spacing={1.25}>
                  <TextField
                    size="small"
                    label={`Receipt Qty (${activeItem.unit})`}
                    type="number"
                    value={receiptQty}
                    onChange={(e) => setReceiptQty(e.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Received date"
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value as ISODate)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="Expiry date (optional)"
                    type="date"
                    value={receiptExpiryDate}
                    onChange={(e) => setReceiptExpiryDate(e.target.value as ISODate)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="Batch code (optional)"
                    value={receiptBatchCode}
                    onChange={(e) => setReceiptBatchCode(e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Supplier (optional)"
                    value={receiptSupplier}
                    onChange={(e) => setReceiptSupplier(e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Notes (optional)"
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    multiline
                    minRows={2}
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      onClick={() => {
                        const qty = Number(receiptQty);
                        if (!Number.isFinite(qty) || qty <= 0) {
                          setSnackbar({ open: true, message: 'Enter a valid receipt quantity.', severity: 'error' });
                          return;
                        }
                        try {
                          receiveStock({
                            itemId: activeItem.id,
                            qty,
                            receivedDate: receiptDate,
                            expiryDate: receiptExpiryDate === '' ? null : receiptExpiryDate,
                            batchCode: receiptBatchCode.trim().length > 0 ? receiptBatchCode.trim() : undefined,
                            supplier: receiptSupplier.trim().length > 0 ? receiptSupplier.trim() : undefined,
                            actorLabel: 'Store Manager',
                            reference: { kind: 'GRN', id: `grn_${receiptDate}` },
                            notes: receiptNotes.trim().length > 0 ? receiptNotes.trim() : undefined,
                          });
                          setSnackbar({
                            open: true,
                            message: `Receipt recorded: +${formatNumber(qty)} ${activeItem.unit}.`,
                            severity: 'success',
                          });
                          setReceiptQty('');
                          setReceiptBatchCode('');
                          setReceiptSupplier('');
                          setReceiptNotes('');
                          setReceiptExpiryDate('');
                        } catch {
                          setSnackbar({ open: true, message: 'Failed to record receipt.', severity: 'error' });
                        }
                      }}
                    >
                      Record Receipt
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Adjustment / Stock Take (Variance)">
                <Stack spacing={1.25}>
                  <FormControl size="small">
                    <InputLabel id="adjust-batch-label">Batch</InputLabel>
                    <Select
                      labelId="adjust-batch-label"
                      value={adjustBatchId}
                      label="Batch"
                      onChange={(e) => setAdjustBatchId(e.target.value as StockBatch['id'])}
                    >
                      {activeItemBatches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.batchCode} (rem {formatNumber(b.remainingQty)})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    label={`New remaining (${activeItem.unit})`}
                    type="number"
                    value={adjustNewRemaining}
                    onChange={(e) => setAdjustNewRemaining(e.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                    helperText={
                      activeAdjustBatch
                        ? `Current remaining: ${formatNumber(activeAdjustBatch.remainingQty)} ${activeItem.unit}`
                        : 'Select a batch to adjust.'
                    }
                  />

                  <TextField
                    size="small"
                    label="Notes (optional)"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    multiline
                    minRows={2}
                    placeholder="Example: Stocktake variance, expiry disposal, spillage."
                  />

                  {activeAdjustBatch ? (
                    <Alert
                      severity="info"
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Variance = new remaining − current remaining
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {(() => {
                          const next = Number(adjustNewRemaining);
                          const delta = (Number.isFinite(next) ? Math.max(0, next) : 0) - activeAdjustBatch.remainingQty;
                          const sign = delta > 0 ? '+' : '';
                          return `${sign}${formatNumber(delta)} ${activeItem.unit}`;
                        })()}
                      </Typography>
                    </Alert>
                  ) : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!activeAdjustBatch) {
                          setSnackbar({ open: true, message: 'Select a batch to adjust.', severity: 'error' });
                          return;
                        }
                        const next = Number(adjustNewRemaining);
                        if (!Number.isFinite(next) || next < 0) {
                          setSnackbar({ open: true, message: 'Enter a valid remaining quantity.', severity: 'error' });
                          return;
                        }
                        try {
                          const result = adjustStock({
                            batchId: activeAdjustBatch.id,
                            asOfDate,
                            newRemainingQty: next,
                            actorLabel: 'Store Manager',
                            reference: { kind: 'Manual', id: `stocktake_${asOfDate}` },
                            notes: adjustNotes.trim().length > 0 ? adjustNotes.trim() : 'Stocktake variance',
                          });
                          if (!result.transaction) {
                            setSnackbar({ open: true, message: 'No change recorded (quantity unchanged).', severity: 'success' });
                            return;
                          }
                          setSnackbar({ open: true, message: 'Adjustment recorded.', severity: 'success' });
                          setAdjustNotes('');
                        } catch {
                          setSnackbar({ open: true, message: 'Failed to record adjustment.', severity: 'error' });
                        }
                      }}
                    >
                      Record Adjustment
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Variance Explanation (Simple)">
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Variance is handled as an adjustment: when physical stock differs from system stock, record the difference in
                    “Adjustment / Stock Take” with an explainable note (e.g., stocktake variance, expiry disposal).
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Recent adjustments for this item
                  </Typography>
                  <Stack spacing={0.75}>
                    {activeItemTransactions
                      .filter((t) => t.type === 'Adjustment')
                      .slice(0, 5)
                      .map((t) => (
                        <Box key={t.id}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {format(parseISO(t.occurredAt), 'MMM d, HH:mm')} • {t.qty > 0 ? '+' : ''}
                            {t.qty} {t.unit}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {t.notes ?? '—'}
                          </Typography>
                        </Box>
                      ))}
                    {activeItemTransactions.filter((t) => t.type === 'Adjustment').length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        No adjustments recorded yet.
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Item Ledger (Recent)">
                <Table size="small" aria-label="Item transactions ledger">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date/Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeItemTransactions.map((t) => {
                      const batch = t.batchId ? batchById.get(t.batchId) : null;
                      return (
                        <TableRow key={t.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {format(parseISO(t.occurredAt), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.type}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{batch?.batchCode ?? (t.batchId ?? '—')}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {t.qty > 0 ? '+' : ''}
                            {t.qty} {t.unit}
                          </TableCell>
                          <TableCell>{t.notes ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {activeItemTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No transactions found for this item.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </SectionCard>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select an item to view batches, actions, and ledger.
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

export default function StockPage() {
  return (
    <React.Suspense fallback={null}>
      <StockPageContent />
    </React.Suspense>
  );
}
