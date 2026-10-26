# CA de Supabase (POL-367)

`supabase-root-2021.crt` es la CA raíz que firma el certificado del pooler de Supabase
(`*.pooler.supabase.com`). La imagen Docker la copia a `/app/certs/` para que `pg` pueda
verificar al servidor con `sslmode=verify-full&sslrootcert=/app/certs/supabase-root-2021.crt`
en la `DATABASE_URL`. No hace falta cambiar código: `pg-connection-string` lee `sslrootcert`.

- Fuente: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Vence: 2031-04-26. Antes de esa fecha hay que reemplazarla (Supabase publica la nueva en su documentación de SSL).
- Verificar: `openssl x509 -in certs/supabase-root-2021.crt -noout -fingerprint -sha256`

## Prueba manual de TLS (POL-367, 2026-10-26)

No es automatizable en la suite: requiere llegar al pooler real. Se hizo con usuario y contraseña
falsos (sin secretos) contra `aws-1-us-east-2.pooler.supabase.com:5432`, usando `pg` del repo.

| # | `DATABASE_URL` | Resultado observado |
|---|---|---|
| 1 | `...?sslmode=require` (sin CA) | `SELF_SIGNED_CERT_IN_CHAIN`: `pg` trata `require` como `verify-full` y Node no trae la CA de Supabase |
| 2 | `...?sslmode=verify-full&sslrootcert=<ruta a esta CA>` | TLS validado; el pooler responde `tenant/user ... not found` (error de usuario, no de certificado) |
| 3 | `openssl x509 -in certs/supabase-root-2021.crt -noout -fingerprint -sha256` | `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, igual a la CA que presenta el servidor y a la descarga oficial |
| 4 | `openssl s_client -starttls postgres -connect <pooler>:5432 -CAfile certs/supabase-root-2021.crt` | `Verify return code: 0 (ok)` |

Repetir con la imagen: la tarea de AWS con la `DATABASE_URL` real debe responder 200 en
`POST /ventas/leer-pedido` (empresa DEMO) sin errores de certificado en el log.
