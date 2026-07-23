import { validateSecurityEnv } from './validate-security-env';

describe('validateSecurityEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('no exige placeholders en desarrollo', () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.DATABASE_URL = 'postgresql://localhost/db';
    process.env.MATEO_HANDOFF_SECRET = 'change-me-handoff';
    process.env.MATEO_WIDGET_JWT_SECRET = 'change-me-widget';

    expect(() => validateSecurityEnv()).not.toThrow();
  });

  it('rechaza secretos placeholder en producción', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.DATABASE_URL = 'postgresql://localhost/db';
    process.env.MATEO_HANDOFF_SECRET = 'change-me-handoff';
    process.env.MATEO_WIDGET_JWT_SECRET = 'real-widget-secret';

    expect(() => validateSecurityEnv()).toThrow(/placeholder inseguro/);
  });
});
