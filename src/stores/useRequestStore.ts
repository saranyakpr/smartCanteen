'use client';

import { create } from 'zustand';

import { getBatchesFEFOSorted } from '@/lib/analytics';
import { getSeedData } from '@/lib/mock-services';
import { useStockStore } from '@/stores/useStockStore';

import type { ISODate, ISODateTime } from '@/types/common';
import type {
  RequisitionIssueEvent,
  RequisitionRequest,
  RequisitionReturnEvent,
  RequestStatus,
  RequestTimelineEvent,
} from '@/types/request';
import type { AppRole } from '@/types/role';
import type { StockBatchAllocation, StockItem } from '@/types/stock';

type CreateRequestInput = {
  date: ISODate;
  requestedByRole: AppRole;
  requestedByLabel: string;
  itemId: StockItem['id'];
  unit: StockItem['unit'];
  requestedQty: number;
  urgency: RequisitionRequest['urgency'];
  remarks?: string;
};

type CreateRequestGroupLineInput = {
  itemId: StockItem['id'];
  requestedQty: number;
  remarks?: string;
};

type CreateRequestGroupInput = {
  date: ISODate;
  requestedByRole: AppRole;
  requestedByLabel: string;
  urgency: RequisitionRequest['urgency'];
  remarks?: string;
  lineItems: CreateRequestGroupLineInput[];
};

type IssueRequestInput = {
  requestId: RequisitionRequest['id'];
  qty: number;
  asOfDate: ISODate;
  issuedByLabel: string;
  remarks?: string;
};

type ReturnRequestInput = {
  requestId: RequisitionRequest['id'];
  qty: number;
  asOfDate: ISODate;
  returnedByLabel: string;
  remarks?: string;
};

type RequestState = {
  requests: RequisitionRequest[];
  issueEvents: RequisitionIssueEvent[];
  returnEvents: RequisitionReturnEvent[];
  createRequest: (input: CreateRequestInput) => RequisitionRequest;
  createRequestGroup: (input: CreateRequestGroupInput) => { requestNo: string; requests: RequisitionRequest[] };
  approveRequest: (requestId: RequisitionRequest['id'], actorLabel: string, note?: string) => void;
  rejectRequest: (requestId: RequisitionRequest['id'], actorLabel: string, note: string) => void;
  issueRequestPartial: (input: IssueRequestInput) => { issuedQty: number; statusAfter: RequestStatus };
  returnIssuedStock: (input: ReturnRequestInput) => { returnedQty: number };
  closeRequest: (requestId: RequisitionRequest['id'], actorLabel: string, note?: string) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<RequestState, 'requests' | 'issueEvents' | 'returnEvents'> {
  const seed = getSeedData();
  return { requests: seed.requests, issueEvents: seed.requestIssues, returnEvents: seed.requestReturns };
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

function isoAtDate(date: ISODate): ISODateTime {
  const timePart = new Date().toISOString().slice(10);
  return `${date}${timePart}` as ISODateTime;
}

function timelineEvent(status: RequestStatus, actorLabel: string, note?: string, at?: ISODateTime): RequestTimelineEvent {
  return { id: `tl_${crypto.randomUUID()}`, at: at ?? nowIso(), status, actorLabel, note };
}

function nextRequestNo(existing: RequisitionRequest[]): string {
  const numbers = existing
    .map((r) => Number(r.requestNo.replace('REQ-', '')))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.sort((a, b) => a - b).at(-1) ?? 1000) + 1;
  return `REQ-${next}`;
}

function ensureTransition(current: RequestStatus, next: RequestStatus): void {
  const allowed: Record<RequestStatus, RequestStatus[]> = {
    Requested: ['Approved', 'Rejected'],
    Approved: ['Partially Issued', 'Issued'],
    Rejected: [],
    'Partially Issued': ['Issued'],
    Issued: ['Closed'],
    Closed: [],
  };

  if (!allowed[current].includes(next)) {
    throw new Error(`Invalid request status transition: ${current} -> ${next}`);
  }
}

export const useRequestStore = create<RequestState>()((set, get) => ({
  ...getSeedDefaults(),

  createRequest: (input) => {
    const requestedQty = Math.max(0, input.requestedQty);
    const request: RequisitionRequest = {
      id: `rq_${crypto.randomUUID()}`,
      requestNo: nextRequestNo(get().requests),
      date: input.date,
      requestedByRole: input.requestedByRole,
      requestedByLabel: input.requestedByLabel,
      itemId: input.itemId,
      unit: input.unit,
      requestedQty,
      issuedQty: 0,
      status: 'Requested',
      urgency: input.urgency,
      remarks: input.remarks,
      timeline: [timelineEvent('Requested', input.requestedByLabel, undefined, isoAtDate(input.date))],
    };

    set((state) => ({ requests: [request, ...state.requests] }));
    return request;
  },

  createRequestGroup: (input) => {
    const requestNo = nextRequestNo(get().requests);
    const stockItems = useStockStore.getState().stockItems;
    const itemById = new Map(stockItems.map((i) => [i.id, i]));

    const requests: RequisitionRequest[] = input.lineItems
      .map((line) => {
        const requestedQty = Math.max(0, line.requestedQty);
        if (requestedQty <= 0) return null;
        const item = itemById.get(line.itemId);
        if (!item) {
          throw new Error(`Unknown stock item: ${line.itemId}`);
        }

        const remarks =
          line.remarks ?? (input.remarks?.trim().length ? input.remarks.trim() : undefined);

        const request: RequisitionRequest = {
          id: `rq_${crypto.randomUUID()}`,
          requestNo,
          date: input.date,
          requestedByRole: input.requestedByRole,
          requestedByLabel: input.requestedByLabel,
          itemId: item.id,
          unit: item.unit,
          requestedQty,
          issuedQty: 0,
          status: 'Requested',
          urgency: input.urgency,
          remarks,
          timeline: [timelineEvent('Requested', input.requestedByLabel, undefined, isoAtDate(input.date))],
        };

        return request;
      })
      .filter((r): r is RequisitionRequest => Boolean(r));

    if (requests.length === 0) {
      throw new Error('Request group has no valid line items.');
    }

    set((state) => ({ requests: [...requests, ...state.requests] }));
    return { requestNo, requests };
  },

  approveRequest: (requestId, actorLabel, note) =>
    set((state) => ({
      requests: state.requests.map((r) => {
        if (r.id !== requestId) return r;
        ensureTransition(r.status, 'Approved');
        return { ...r, status: 'Approved', timeline: [...r.timeline, timelineEvent('Approved', actorLabel, note)] };
      }),
    })),

  rejectRequest: (requestId, actorLabel, note) =>
    set((state) => ({
      requests: state.requests.map((r) => {
        if (r.id !== requestId) return r;
        ensureTransition(r.status, 'Rejected');
        return { ...r, status: 'Rejected', timeline: [...r.timeline, timelineEvent('Rejected', actorLabel, note)] };
      }),
    })),

  issueRequestPartial: (input) => {
    const state = get();
    const request = state.requests.find((r) => r.id === input.requestId);
    if (!request) throw new Error(`Unknown request: ${input.requestId}`);
    if (request.status !== 'Approved' && request.status !== 'Partially Issued') {
      throw new Error(`Request is not issuable in status: ${request.status}`);
    }

    const remainingQty = Math.max(0, request.requestedQty - request.issuedQty);
    const desiredQty = Math.min(Math.max(0, input.qty), remainingQty);
    if (desiredQty <= 0) return { issuedQty: 0, statusAfter: request.status };

    const stockResult = useStockStore.getState().issueStockFEFO({
      itemId: request.itemId,
      qty: desiredQty,
      asOfDate: input.asOfDate,
      actorLabel: input.issuedByLabel,
      reference: { kind: 'Requisition', id: request.id },
      notes: input.remarks,
    });

    const issuedQty = stockResult.issuedQty;
    if (issuedQty <= 0) return { issuedQty: 0, statusAfter: request.status };

    const nextIssuedQty = request.issuedQty + issuedQty;
    const nextStatus: RequestStatus = nextIssuedQty >= request.requestedQty ? 'Issued' : 'Partially Issued';
    if (request.status !== nextStatus) ensureTransition(request.status, nextStatus);

    const issueEvent: RequisitionIssueEvent = {
      id: `ri_${crypto.randomUUID()}`,
      requestId: request.id,
      occurredAt: isoAtDate(input.asOfDate),
      itemId: request.itemId,
      unit: request.unit,
      issuedQty,
      allocations: stockResult.allocations,
      issuedByLabel: input.issuedByLabel,
      remarks: input.remarks,
    };

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === request.id
          ? {
              ...r,
              issuedQty: nextIssuedQty,
              status: nextStatus,
              timeline: [...r.timeline, timelineEvent(nextStatus, input.issuedByLabel, input.remarks, isoAtDate(input.asOfDate))],
            }
          : r,
      ),
      issueEvents: [issueEvent, ...s.issueEvents],
    }));

    return { issuedQty, statusAfter: nextStatus };
  },

  returnIssuedStock: (input) => {
    const state = get();
    const request = state.requests.find((r) => r.id === input.requestId);
    if (!request) throw new Error(`Unknown request: ${input.requestId}`);

    if (!['Partially Issued', 'Issued', 'Closed'].includes(request.status)) {
      throw new Error(`Returns are not allowed in status: ${request.status}`);
    }

    const desiredQty = Math.max(0, input.qty);
    if (desiredQty <= 0) return { returnedQty: 0 };

    const relatedIssues = state.issueEvents.filter((e) => e.requestId === request.id);
    if (relatedIssues.length === 0) {
      throw new Error('No issued stock found for this request.');
    }

    const issuedByBatch = new Map<string, number>();
    for (const ev of relatedIssues) {
      for (const a of ev.allocations) {
        issuedByBatch.set(a.batchId, (issuedByBatch.get(a.batchId) ?? 0) + a.qty);
      }
    }

    const returnedByBatch = new Map<string, number>();
    for (const ev of state.returnEvents.filter((e) => e.requestId === request.id)) {
      for (const a of ev.allocations) {
        returnedByBatch.set(a.batchId, (returnedByBatch.get(a.batchId) ?? 0) + a.qty);
      }
    }

    const availableByBatch = new Map<string, number>();
    for (const [batchId, issuedQty] of issuedByBatch.entries()) {
      const alreadyReturned = returnedByBatch.get(batchId) ?? 0;
      const available = issuedQty - alreadyReturned;
      if (available > 0) availableByBatch.set(batchId, available);
    }

    const totalAvailable = Array.from(availableByBatch.values()).reduce((sum, v) => sum + v, 0);
    const returnQty = Math.min(desiredQty, totalAvailable);
    if (returnQty <= 0) return { returnedQty: 0 };

    const stockBatches = useStockStore.getState().stockBatches;
    const sorted = getBatchesFEFOSorted(stockBatches, request.itemId).filter((b) => (availableByBatch.get(b.id) ?? 0) > 0);

    let remaining = returnQty;
    const allocations: StockBatchAllocation[] = [];

    for (const batch of sorted) {
      if (remaining <= 0) break;
      const available = availableByBatch.get(batch.id) ?? 0;
      const take = Math.min(available, remaining);
      if (take <= 0) continue;
      allocations.push({ batchId: batch.id, qty: take });
      remaining -= take;
    }

    if (remaining > 0) {
      for (const [batchId, available] of availableByBatch.entries()) {
        if (remaining <= 0) break;
        if (allocations.some((a) => a.batchId === batchId)) continue;
        const take = Math.min(available, remaining);
        if (take <= 0) continue;
        allocations.push({ batchId, qty: take });
        remaining -= take;
      }
    }

    const stockResult = useStockStore.getState().returnStockToBatches({
      allocations,
      asOfDate: input.asOfDate,
      actorLabel: input.returnedByLabel,
      reference: { kind: 'Requisition', id: request.id },
      notes: input.remarks,
    });

    const returnedQty = stockResult.returnedQty;
    if (returnedQty <= 0) return { returnedQty: 0 };

    const returnEvent: RequisitionReturnEvent = {
      id: `rr_${crypto.randomUUID()}`,
      requestId: request.id,
      occurredAt: isoAtDate(input.asOfDate),
      itemId: request.itemId,
      unit: request.unit,
      returnedQty,
      allocations: stockResult.allocations,
      returnedByLabel: input.returnedByLabel,
      remarks: input.remarks,
    };

    set((s) => ({ returnEvents: [returnEvent, ...s.returnEvents] }));
    return { returnedQty };
  },

  closeRequest: (requestId, actorLabel, note) =>
    set((state) => ({
      requests: state.requests.map((r) => {
        if (r.id !== requestId) return r;
        ensureTransition(r.status, 'Closed');
        return { ...r, status: 'Closed', timeline: [...r.timeline, timelineEvent('Closed', actorLabel, note)] };
      }),
    })),

  resetToSeed: () => set(getSeedDefaults()),
}));
