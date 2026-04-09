export const APP_ROLES = ['Admin', 'Chef', 'Store Manager', 'Canteen Manager', 'Management'] as const;

export type AppRole = (typeof APP_ROLES)[number];

