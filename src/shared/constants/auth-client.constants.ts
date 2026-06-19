export const AUTH_CLIENT = {
  WMS: 'wms',
  MATEO: 'mateo',
} as const;

export type AuthClient = (typeof AUTH_CLIENT)[keyof typeof AUTH_CLIENT];

export const AUTH_CLIENT_HEADER = 'x-auth-client';
