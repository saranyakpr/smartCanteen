import type { ISODate, ISODateTime, Urgency } from '@/types/common';
import type { AppRole } from '@/types/role';
import type { StockBatchAllocation, StockItem } from '@/types/stock';

export type RequestStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Partially Issued'
  | 'Issued'
  | 'Closed';

export type RequestTimelineEvent = {
  id: string;
  at: ISODateTime;
  status: RequestStatus;
  actorLabel: string;
  note?: string;
};

export type RequisitionRequest = {
  id: string;
  requestNo: string;
  date: ISODate;
  requestedByRole: AppRole;
  requestedByLabel: string;
  itemId: StockItem['id'];
  unit: StockItem['unit'];
  requestedQty: number;
  issuedQty: number;
  status: RequestStatus;
  urgency: Urgency;
  remarks?: string;
  timeline: RequestTimelineEvent[];
};

export type RequisitionIssueEvent = {
  id: string;
  requestId: RequisitionRequest['id'];
  occurredAt: ISODateTime;
  itemId: StockItem['id'];
  unit: StockItem['unit'];
  issuedQty: number;
  allocations: StockBatchAllocation[];
  issuedByLabel: string;
  remarks?: string;
};

export type RequisitionReturnEvent = {
  id: string;
  requestId: RequisitionRequest['id'];
  occurredAt: ISODateTime;
  itemId: StockItem['id'];
  unit: StockItem['unit'];
  returnedQty: number;
  allocations: StockBatchAllocation[];
  returnedByLabel: string;
  remarks?: string;
};
