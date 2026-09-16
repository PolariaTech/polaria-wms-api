export const ROL_CONFIGURADOR = 'configurador' as const;

export const AUTH_FLOW = {
  PLATFORM: 'platform',
  TENANT: 'tenant',
} as const;

export type AuthFlow = (typeof AUTH_FLOW)[keyof typeof AUTH_FLOW];

export const AUTH_SCOPE = {
  PLATFORM: 'platform',
  TENANT: 'tenant',
} as const;

export type AuthScope = (typeof AUTH_SCOPE)[keyof typeof AUTH_SCOPE];

/** Access token WMS (Supabase JWT) y JWT del widget Mateo. El código one-time de handoff sigue en 60 s. */
export const AUTH_SESSION_TTL_SECONDS = 12 * 60 * 60;
