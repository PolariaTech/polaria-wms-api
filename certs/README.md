# CA de Supabase (POL-367)

`supabase-root-2021.crt` es la CA raíz que firma el certificado del pooler de Supabase
(`*.pooler.supabase.com`). La imagen Docker la copia a `/app/certs/` para que `pg` pueda
verificar al servidor con `sslmode=verify-full&sslrootcert=/app/certs/supabase-root-2021.crt`
en la `DATABASE_URL`. No hace falta cambiar código: `pg-connection-string` lee `sslrootcert`.

- Fuente: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Vence: 2031-04-26. Antes de esa fecha hay que reemplazarla (Supabase publica la nueva en su documentación de SSL).
- Verificar: `openssl x509 -in certs/supabase-root-2021.crt -noout -fingerprint -sha256`
