const DEFAULT_MATEO_ORIGINS =
  'https://chatbot-mateo.vercel.app,http://localhost:3000';

export const envConfig = () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  MATEO_HANDOFF_SECRET: process.env.MATEO_HANDOFF_SECRET ?? '',
  MATEO_ALLOWED_ORIGINS:
    process.env.MATEO_ALLOWED_ORIGINS ?? DEFAULT_MATEO_ORIGINS,
});
