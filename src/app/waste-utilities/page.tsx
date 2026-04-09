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
  Typography,
} from '@mui/material';
import { format, parseISO } from 'date-fns';

import { FilterBar } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { detectUtilitySpike } from '@/lib/analytics';
import { buildCsv, downloadCsv, type CsvColumn } from '@/lib/exports/csv';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate, Session } from '@/types/common';
import type { UtilityType, UtilityUnit } from '@/types/utilities';
import type { WasteReason } from '@/types/waste';

const SESSIONS: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];
const WASTE_REASONS: WasteReason[] = ['Overproduction', 'Low Demand', 'Quality Issue', 'Spoilage', 'Spillage', 'Other'];
const UTILITY_TYPES: UtilityType[] = ['Electricity', 'Water', 'LPG'];

function getUtilityUnit(type: UtilityType): UtilityUnit {
  switch (type) {
    case 'Water':
      return 'KL';
    case 'LPG':
      return 'kg';
    case 'Electricity':
    default:
      return 'kWh';
  }
}

function isPositiveNumber(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function asNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function WasteUtilitiesPageContent() {
  const searchParams = useSearchParams();

  const asOfDate = useDashboardStore((s) => s.asOfDate);

  const menuItems = useMenuStore((s) => s.menuItems);
  const menuSessions = useMenuStore((s) => s.menuSessions);
  const updateMenuSession = useMenuStore((s) => s.updateMenuSession);

  const wasteEntries = useWasteStore((s) => s.wasteEntries);
  const addWasteEntry = useWasteStore((s) => s.addWasteEntry);
  const updateWasteEntry = useWasteStore((s) => s.updateWasteEntry);
  const deleteWasteEntry = useWasteStore((s) => s.deleteWasteEntry);
  const dailyNotes = useWasteStore((s) => s.dailyNotes);
  const setDailyNote = useWasteStore((s) => s.setDailyNote);

  const utilityEntries = useUtilitiesStore((s) => s.utilityEntries);
  const addUtilityEntry = useUtilitiesStore((s) => s.addUtilityEntry);
  const updateUtilityEntry = useUtilitiesStore((s) => s.updateUtilityEntry);
  const deleteUtilityEntry = useUtilitiesStore((s) => s.deleteUtilityEntry);

  const menuById = React.useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  const paramDate = (searchParams.get('date') as ISODate | null) ?? null;
  const [selectedDate, setSelectedDate] = React.useState<ISODate>(paramDate ?? asOfDate);
  const [selectedSession, setSelectedSession] = React.useState<Session>('Lunch');

  React.useEffect(() => {
    if (paramDate) setSelectedDate(paramDate);
  }, [paramDate]);

  const plannedSessionRecord = React.useMemo(
    () => menuSessions.find((s) => s.date === selectedDate && s.session === selectedSession) ?? null,
    [menuSessions, selectedDate, selectedSession],
  );

  const plannedMenuItemName = React.useMemo(() => {
    if (!plannedSessionRecord) return '—';
    return menuById.get(plannedSessionRecord.menuItemId)?.name ?? plannedSessionRecord.menuItemId;
  }, [menuById, plannedSessionRecord]);

  const latestWasteForContext = React.useMemo(() => {
    if (!plannedSessionRecord) return null;
    return (
      wasteEntries
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .find(
          (w) =>
            w.date === selectedDate &&
            w.session === selectedSession &&
            w.menuItemId === plannedSessionRecord.menuItemId,
        ) ?? null
    );
  }, [plannedSessionRecord, selectedDate, selectedSession, wasteEntries]);

  const [editingWasteId, setEditingWasteId] = React.useState<string | null>(null);
  const [wasteQty, setWasteQty] = React.useState('');
  const [wasteReason, setWasteReason] = React.useState<WasteReason>('Overproduction');
  const [wasteNotes, setWasteNotes] = React.useState('');

  const [leftoverQty, setLeftoverQty] = React.useState('');
  const [sessionNotes, setSessionNotes] = React.useState('');

  const [dailyNoteDraft, setDailyNoteDraft] = React.useState('');

  const [editingUtilityId, setEditingUtilityId] = React.useState<string | null>(null);
  const [utilityDate, setUtilityDate] = React.useState<ISODate>(selectedDate);
  const [utilityType, setUtilityType] = React.useState<UtilityType>('Electricity');
  const [utilityAmount, setUtilityAmount] = React.useState('');
  const [utilityNotes, setUtilityNotes] = React.useState('');

  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  React.useEffect(() => {
    if (plannedSessionRecord) {
      setLeftoverQty(String(plannedSessionRecord.leftoverQty));
      setSessionNotes(plannedSessionRecord.notes ?? '');
    } else {
      setLeftoverQty('');
      setSessionNotes('');
    }
  }, [plannedSessionRecord]);

  React.useEffect(() => {
    const editing = editingWasteId ? wasteEntries.find((w) => w.id === editingWasteId) ?? null : null;
    const source = editing ?? latestWasteForContext;
    if (source) {
      setWasteQty(String(source.wasteQty));
      setWasteReason(source.reason);
      setWasteNotes(source.notes ?? '');
      return;
    }
    setWasteQty('');
    setWasteReason('Overproduction');
    setWasteNotes('');
  }, [editingWasteId, latestWasteForContext, wasteEntries]);

  React.useEffect(() => {
    setDailyNoteDraft(dailyNotes[selectedDate] ?? '');
  }, [dailyNotes, selectedDate]);

  React.useEffect(() => {
    setUtilityDate(selectedDate);
  }, [selectedDate]);

  const wastePreparedQty = plannedSessionRecord?.preparedQty ?? 0;
  const wasteValidationErrors: string[] = [];
  if (!plannedSessionRecord) {
    wasteValidationErrors.push('No planned menu session found for the selected date and session.');
  }
  if (wasteQty.trim().length === 0) {
    wasteValidationErrors.push('Waste quantity is required.');
  } else if (!isPositiveNumber(wasteQty)) {
    wasteValidationErrors.push('Waste quantity must be a positive number.');
  } else if (plannedSessionRecord && asNumber(wasteQty) > wastePreparedQty) {
    wasteValidationErrors.push(`Waste quantity must be ≤ prepared quantity (${wastePreparedQty}).`);
  }

  const leftoverValidationErrors: string[] = [];
  if (!plannedSessionRecord) {
    leftoverValidationErrors.push('No planned menu session found for the selected date and session.');
  }
  if (leftoverQty.trim().length === 0) {
    leftoverValidationErrors.push('Leftover quantity is required.');
  } else if (asNumber(leftoverQty) < 0) {
    leftoverValidationErrors.push('Leftover quantity must be 0 or more.');
  } else if (plannedSessionRecord && asNumber(leftoverQty) > plannedSessionRecord.preparedQty) {
    leftoverValidationErrors.push(`Leftover quantity must be ≤ prepared quantity (${plannedSessionRecord.preparedQty}).`);
  }

  const utilityValidationErrors: string[] = [];
  if (utilityAmount.trim().length === 0) {
    utilityValidationErrors.push('Amount is required.');
  } else if (!isPositiveNumber(utilityAmount)) {
    utilityValidationErrors.push('Amount must be a positive number.');
  }

  const electricitySpike = React.useMemo(() => {
    return detectUtilitySpike({
      utilityEntries,
      asOfDate: utilityDate,
      utilityType: 'Electricity',
      lookbackDays: 7,
      spikeRatioThreshold: 1.35,
    });
  }, [utilityDate, utilityEntries]);

  const latestElectricitySpike = React.useMemo(() => {
    const electricityDates = Array.from(
      new Set(utilityEntries.filter((u) => u.utilityType === 'Electricity').map((u) => u.date)),
    ).sort();

    const spikes = electricityDates
      .map((date) => {
        const spike = detectUtilitySpike({
          utilityEntries,
          asOfDate: date,
          utilityType: 'Electricity',
          lookbackDays: 7,
          spikeRatioThreshold: 1.35,
        });
        if (!spike.isSpike) return null;
        return { date, ...spike };
      })
      .filter((x): x is { date: ISODate; isSpike: true; todayAmount: number; baselineAvg: number; ratio: number } => Boolean(x));

    return spikes.at(-1) ?? null;
  }, [utilityEntries]);

  const recentWaste = React.useMemo(() => {
    return wasteEntries
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12);
  }, [wasteEntries]);

  const recentUtilities = React.useMemo(() => {
    return utilityEntries
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 24);
  }, [utilityEntries]);

  const exportWasteCsv = React.useCallback(() => {
    type Row = { date: ISODate; session: Session; menuItem: string; wasteQty: number; reason: string; notes: string };
    const rows: Row[] = recentWaste.map((w) => ({
      date: w.date,
      session: w.session,
      menuItem: menuById.get(w.menuItemId)?.name ?? w.menuItemId,
      wasteQty: w.wasteQty,
      reason: w.reason,
      notes: w.notes ?? '',
    }));

    const columns: Array<CsvColumn<Row>> = [
      { key: 'date', label: 'Date' },
      { key: 'session', label: 'Session' },
      { key: 'menuItem', label: 'MenuItem' },
      { key: 'wasteQty', label: 'WasteQty(plates)' },
      { key: 'reason', label: 'Reason' },
      { key: 'notes', label: 'Notes' },
    ];

    const csv = buildCsv(columns, rows);
    downloadCsv({ filename: `waste_entries_${selectedDate}`, csv });
  }, [menuById, recentWaste, selectedDate]);

  const exportUtilitiesCsv = React.useCallback(() => {
    type Row = { date: ISODate; utilityType: string; amount: number; unit: string; notes: string };
    const rows: Row[] = recentUtilities.map((u) => ({
      date: u.date,
      utilityType: u.utilityType,
      amount: u.amount,
      unit: u.unit,
      notes: u.notes ?? '',
    }));

    const columns: Array<CsvColumn<Row>> = [
      { key: 'date', label: 'Date' },
      { key: 'utilityType', label: 'UtilityType' },
      { key: 'amount', label: 'Amount' },
      { key: 'unit', label: 'Unit' },
      { key: 'notes', label: 'Notes' },
    ];

    const csv = buildCsv(columns, rows);
    downloadCsv({ filename: `utility_entries_${selectedDate}`, csv });
  }, [recentUtilities, selectedDate]);

  const startEditUtility = (id: string) => {
    const entry = utilityEntries.find((u) => u.id === id);
    if (!entry) return;
    setEditingUtilityId(entry.id);
    setUtilityDate(entry.date);
    setUtilityType(entry.utilityType);
    setUtilityAmount(String(entry.amount));
    setUtilityNotes(entry.notes ?? '');
  };

  const resetUtilityForm = () => {
    setEditingUtilityId(null);
    setUtilityDate(selectedDate);
    setUtilityType('Electricity');
    setUtilityAmount('');
    setUtilityNotes('');
  };

  const handleSaveWaste = () => {
    if (wasteValidationErrors.length > 0 || !plannedSessionRecord) {
      setSnackbar({ open: true, message: 'Fix validation errors before saving waste.', severity: 'error' });
      return;
    }

    const payload = {
      date: selectedDate,
      session: selectedSession,
      menuItemId: plannedSessionRecord.menuItemId,
      wasteQty: asNumber(wasteQty),
      reason: wasteReason,
      notes: wasteNotes.trim().length > 0 ? wasteNotes.trim() : undefined,
    } as const;

    if (editingWasteId) {
      updateWasteEntry(editingWasteId, payload);
      setSnackbar({ open: true, message: 'Waste entry updated.', severity: 'success' });
      setEditingWasteId(null);
      return;
    }

    if (latestWasteForContext) {
      updateWasteEntry(latestWasteForContext.id, payload);
      setSnackbar({ open: true, message: 'Waste entry updated.', severity: 'success' });
      return;
    }

    addWasteEntry(payload);
    setSnackbar({ open: true, message: 'Waste entry saved.', severity: 'success' });
  };

  const handleSaveLeftover = () => {
    if (leftoverValidationErrors.length > 0 || !plannedSessionRecord) {
      setSnackbar({ open: true, message: 'Fix validation errors before saving leftovers.', severity: 'error' });
      return;
    }

    const nextLeftover = Math.max(0, asNumber(leftoverQty));
    const nextServed = Math.max(0, plannedSessionRecord.preparedQty - nextLeftover);
    updateMenuSession(plannedSessionRecord.id, {
      leftoverQty: nextLeftover,
      servedQty: nextServed,
      notes: sessionNotes.trim().length > 0 ? sessionNotes.trim() : undefined,
    });
    setSnackbar({ open: true, message: 'Leftover entry saved (served recalculated).', severity: 'success' });
  };

  const handleSaveDailyNote = () => {
    setDailyNote(selectedDate, dailyNoteDraft);
    setSnackbar({ open: true, message: 'Daily note saved.', severity: 'success' });
  };

  const handleSaveUtility = () => {
    if (utilityValidationErrors.length > 0) {
      setSnackbar({ open: true, message: 'Fix validation errors before saving utilities.', severity: 'error' });
      return;
    }

    const unit = getUtilityUnit(utilityType);
    const payload = {
      date: utilityDate,
      utilityType,
      unit,
      amount: asNumber(utilityAmount),
      notes: utilityNotes.trim().length > 0 ? utilityNotes.trim() : undefined,
    } as const;

    if (editingUtilityId) {
      updateUtilityEntry(editingUtilityId, payload);
      setSnackbar({ open: true, message: 'Utility entry updated.', severity: 'success' });
      resetUtilityForm();
      return;
    }

    const existing = utilityEntries.find((u) => u.date === payload.date && u.utilityType === payload.utilityType);
    if (existing) {
      updateUtilityEntry(existing.id, payload);
      setSnackbar({ open: true, message: 'Utility entry updated.', severity: 'success' });
      resetUtilityForm();
      return;
    }

    addUtilityEntry(payload);
    setSnackbar({ open: true, message: 'Utility entry saved.', severity: 'success' });
    resetUtilityForm();
  };

  return (
    <>
      <PageHeader
        title="Waste & Utilities"
        subtitle="Record waste and utility usage with reasons, notes, and validation."
      />

      <Stack spacing={2}>
        <FilterBar
          right={
            <Typography variant="caption" color="text.secondary">
              As of: {format(parseISO(asOfDate), 'EEE, dd MMM yyyy')}
            </Typography>
          }
        >
          <TextField
            size="small"
            label="Date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setEditingWasteId(null);
              setSelectedDate(e.target.value as ISODate);
            }}
            InputLabelProps={{ shrink: true }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="waste-session-label">Session</InputLabel>
            <Select
              labelId="waste-session-label"
              value={selectedSession}
              label="Session"
              onChange={(e) => {
                setEditingWasteId(null);
                setSelectedSession(e.target.value as Session);
              }}
            >
              {SESSIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Planned menu
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {plannedMenuItemName}
            </Typography>
          </Box>
        </FilterBar>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard title="Waste Entry">
              <Stack spacing={1.25}>
                <Typography variant="caption" color="text.secondary">
                  Prepared: {plannedSessionRecord ? plannedSessionRecord.preparedQty : '—'} • Served:{' '}
                  {plannedSessionRecord ? plannedSessionRecord.servedQty : '—'} • Leftover:{' '}
                  {plannedSessionRecord ? plannedSessionRecord.leftoverQty : '—'}
                </Typography>

                <TextField
                  label="Waste Quantity"
                  type="number"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  size="small"
                  inputProps={{ min: 0, step: 1 }}
                  error={wasteValidationErrors.length > 0}
                  helperText={wasteValidationErrors[0] ?? 'Enter the waste quantity for this session.'}
                />

                <FormControl size="small">
                  <InputLabel id="waste-reason-label">Reason</InputLabel>
                  <Select
                    labelId="waste-reason-label"
                    value={wasteReason}
                    label="Reason"
                    onChange={(e) => setWasteReason(e.target.value as WasteReason)}
                  >
                    {WASTE_REASONS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Waste Notes (optional)"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  size="small"
                  multiline
                  minRows={2}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  {editingWasteId ? (
                    <Button variant="text" onClick={() => setEditingWasteId(null)}>
                      Cancel edit
                    </Button>
                  ) : null}
                  <Button variant="contained" onClick={handleSaveWaste} disabled={wasteValidationErrors.length > 0}>
                    {editingWasteId || latestWasteForContext ? 'Update Waste Entry' : 'Save Waste Entry'}
                  </Button>
                </Stack>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Leftover Entry
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Leftover is recorded per session. Served quantity is recalculated as Prepared − Leftover.
                </Typography>

                <TextField
                  label="Leftover Quantity"
                  type="number"
                  value={leftoverQty}
                  onChange={(e) => setLeftoverQty(e.target.value)}
                  size="small"
                  inputProps={{ min: 0, step: 1 }}
                  error={leftoverValidationErrors.length > 0}
                  helperText={leftoverValidationErrors[0] ?? 'Enter leftover quantity for this session.'}
                  disabled={!plannedSessionRecord}
                />

                <TextField
                  label="Session Notes (optional)"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  size="small"
                  multiline
                  minRows={2}
                  disabled={!plannedSessionRecord}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={handleSaveLeftover} disabled={leftoverValidationErrors.length > 0}>
                    Save Leftover Entry
                  </Button>
                </Stack>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Daily Notes
                </Typography>
                <TextField
                  label={`Notes for ${selectedDate}`}
                  value={dailyNoteDraft}
                  onChange={(e) => setDailyNoteDraft(e.target.value)}
                  size="small"
                  multiline
                  minRows={3}
                  placeholder="Add operational notes for the day (waste drivers, supplier issues, staffing)."
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={handleSaveDailyNote}>
                    Save Daily Note
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard
              title="Utility Entry"
              actions={
                utilityType === 'Electricity' && electricitySpike.isSpike ? (
                  <StatusChip label="Electricity spike detected" color="warning" />
                ) : null
              }
            >
              <Stack spacing={1.25}>
                {latestElectricitySpike ? (
                  <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Latest electricity spike: {format(parseISO(latestElectricitySpike.date), 'MMM d')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {latestElectricitySpike.todayAmount.toFixed(0)} kWh • {latestElectricitySpike.ratio.toFixed(1)}× baseline
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => {
                          setUtilityType('Electricity');
                          setUtilityDate(latestElectricitySpike.date);
                        }}
                      >
                        Jump to day
                      </Button>
                    </Stack>
                  </Alert>
                ) : null}

                <TextField
                  size="small"
                  label="Date"
                  type="date"
                  value={utilityDate}
                  onChange={(e) => setUtilityDate(e.target.value as ISODate)}
                  InputLabelProps={{ shrink: true }}
                />

                <FormControl size="small">
                  <InputLabel id="utility-type-label">Utility</InputLabel>
                  <Select
                    labelId="utility-type-label"
                    value={utilityType}
                    label="Utility"
                    onChange={(e) => setUtilityType(e.target.value as UtilityType)}
                  >
                    {UTILITY_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label={`Amount (${getUtilityUnit(utilityType)})`}
                  type="number"
                  value={utilityAmount}
                  onChange={(e) => setUtilityAmount(e.target.value)}
                  size="small"
                  inputProps={{ min: 0, step: 0.1 }}
                  error={utilityValidationErrors.length > 0}
                  helperText={
                    utilityValidationErrors[0] ??
                    (utilityType === 'Electricity'
                      ? `Baseline avg: ${electricitySpike.baselineAvg.toFixed(0)} kWh (7 days)`
                      : 'Enter the recorded amount for the day.')
                  }
                />

                <TextField
                  label="Utility Notes (optional)"
                  value={utilityNotes}
                  onChange={(e) => setUtilityNotes(e.target.value)}
                  size="small"
                  multiline
                  minRows={2}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  {editingUtilityId ? (
                    <Button variant="text" onClick={resetUtilityForm}>
                      Cancel edit
                    </Button>
                  ) : null}
                  <Button variant="contained" onClick={handleSaveUtility} disabled={utilityValidationErrors.length > 0}>
                    {editingUtilityId ? 'Update Utility Entry' : 'Save Utility Entry'}
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard
              title="Recent Waste Entries"
              actions={
                <Button size="small" variant="outlined" onClick={exportWasteCsv}>
                  Export CSV
                </Button>
              }
            >
              <Table size="small" aria-label="Recent waste entries">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Session</TableCell>
                    <TableCell>Menu Item</TableCell>
                    <TableCell align="right">Waste</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentWaste.map((w) => (
                    <TableRow key={w.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseISO(w.date), 'MMM d')}</TableCell>
                      <TableCell>{w.session}</TableCell>
                      <TableCell>{menuById.get(w.menuItemId)?.name ?? w.menuItemId}</TableCell>
                      <TableCell align="right">{w.wasteQty}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{w.reason}</TableCell>
                      <TableCell>{w.notes ?? '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingWasteId(w.id);
                            setSelectedDate(w.date);
                            setSelectedSession(w.session);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            deleteWasteEntry(w.id);
                            setSnackbar({ open: true, message: 'Waste entry deleted.', severity: 'success' });
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentWaste.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No waste entries found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard
              title="Recent Utility Entries"
              actions={
                <Button size="small" variant="outlined" onClick={exportUtilitiesCsv}>
                  Export CSV
                </Button>
              }
            >
              <Table size="small" aria-label="Recent utility entries">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Utility</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentUtilities.map((u) => {
                    const spike =
                      u.utilityType === 'Electricity'
                        ? detectUtilitySpike({
                            utilityEntries,
                            asOfDate: u.date,
                            utilityType: 'Electricity',
                            lookbackDays: 7,
                            spikeRatioThreshold: 1.35,
                          }).isSpike
                        : false;

                    return (
                      <TableRow key={u.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseISO(u.date), 'MMM d')}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {u.utilityType}
                            </Typography>
                            {spike ? <StatusChip label="Spike" color="warning" /> : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {u.amount} {u.unit}
                        </TableCell>
                        <TableCell>{u.notes ?? '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button size="small" onClick={() => startEditUtility(u.id)}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              deleteUtilityEntry(u.id);
                              setSnackbar({ open: true, message: 'Utility entry deleted.', severity: 'success' });
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recentUtilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No utility entries found.
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

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default function WasteUtilitiesPage() {
  return (
    <React.Suspense fallback={null}>
      <WasteUtilitiesPageContent />
    </React.Suspense>
  );
}
