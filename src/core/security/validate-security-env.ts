const INSECURE_PLACEHOLDERS = [
  'change-me',
  'your-',
  'example',
  'test-widget-secret',
  'test-handoff-secret',
];

export function validateSecurityEnv(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'MATEO_HANDOFF_SECRET',
    'MATEO_WIDGET_JWT_SECRET',
  ];

  for (const key of required) {
    const value = process.env[key]?.trim();
    if (!value) {
      throw new Error(`Variable de entorno obligatoria ausente: ${key}`);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  for (const key of ['MATEO_HANDOFF_SECRET', 'MATEO_WIDGET_JWT_SECRET']) {
    const value = process.env[key]?.trim().toLowerCase() ?? '';
    if (INSECURE_PLACEHOLDERS.some((p) => value.includes(p))) {
      throw new Error(
        `Variable ${key} usa un valor placeholder inseguro en producción.`,
      );
    }
  }

  if (
    process.env.MATEO_HANDOFF_SECRET === process.env.MATEO_WIDGET_JWT_SECRET
  ) {
    throw new Error(
      'MATEO_HANDOFF_SECRET y MATEO_WIDGET_JWT_SECRET deben ser distintos.',
    );
  }
}
