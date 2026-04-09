import type { ISODate, ISODateTime } from '@/types/common';

export type UtilityType = 'Electricity' | 'Water' | 'LPG';
export type UtilityUnit = 'kWh' | 'KL' | 'kg';

export type UtilityEntry = {
  id: string;
  date: ISODate;
  utilityType: UtilityType;
  unit: UtilityUnit;
  amount: number;
  notes?: string;
  createdAt: ISODateTime;
};

