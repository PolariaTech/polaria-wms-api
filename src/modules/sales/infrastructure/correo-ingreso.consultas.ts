/** POL-415: fragmentos SQL de intentos y vencimiento del ingreso de correo. */

export const MENSAJE_INGRESO_VENCIDO =
  'El ingreso no terminó. Toca Reintentar.';

export const ERROR_INTENTO_VENCIDO = 'El ingreso no terminó';

const ISO_UTC_SQL = `to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const sqlObjetoIntentoNuevo = (nSql: string) =>
  `jsonb_build_object(
    'n', ${nSql},
    'iniciado_at', ${ISO_UTC_SQL},
    'terminado_at', null,
    'duracion_ms', null,
    'resultado', 'procesando',
    'error', null
  )`;

export function sqlIntentoInicialInsert(): string {
  return `jsonb_build_array(${sqlObjetoIntentoNuevo('1')})`;
}

export function sqlIntentoAppendUpdate(): string {
  return `COALESCE(c.intentos, '[]'::jsonb) || jsonb_build_array(${sqlObjetoIntentoNuevo(
    "jsonb_array_length(COALESCE(c.intentos, '[]'::jsonb)) + 1",
  )})`;
}

export function sqlCerrarUltimoIntento(
  resultado: 'ingresado' | 'error' | 'vencido',
  errorExpr: string,
): string {
  return `CASE
    WHEN COALESCE(jsonb_array_length(intentos), 0) = 0 THEN COALESCE(intentos, '[]'::jsonb)
    ELSE jsonb_set(
      intentos,
      ARRAY[(jsonb_array_length(intentos) - 1)::text],
      (intentos->-1) || jsonb_build_object(
        'terminado_at', ${ISO_UTC_SQL},
        'duracion_ms', GREATEST(0, (EXTRACT(EPOCH FROM (now() - (intentos->-1->>'iniciado_at')::timestamptz)) * 1000)::bigint),
        'resultado', '${resultado}',
        'error', ${errorExpr}
      )
    )
  END`;
}

export function selloNumeroCorreo(
  messageId: string,
): [{ 'Numero correo': string }] {
  return [{ 'Numero correo': messageId }];
}
