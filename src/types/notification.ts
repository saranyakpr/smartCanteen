import type { ISODateTime, Severity } from '@/types/common';

export type NotificationChannel = 'In-App' | 'Email' | 'SMS' | 'WhatsApp';

export type NotificationChannelState = {
  channel: NotificationChannel;
  active: boolean;
};

export type NotificationItem = {
  id: string;
  createdAt: ISODateTime;
  title: string;
  severity: Severity;
  sourceModule:
    | 'Dashboard'
    | 'Menu & Consumption'
    | 'Waste & Utilities'
    | 'Stock & Inventory'
    | 'Requests & Issues'
    | 'Feedback'
    | 'Recommendations'
    | 'Reports';
  message: string;
  quickActionLabel?: string;
  read: boolean;
  channels: NotificationChannelState[];
  related?: { kind: string; id: string };
};

