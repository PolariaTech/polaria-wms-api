import type { ModoCorreos } from '../dto/correos-query.dto';

/** Una fila de `correo_pedido_entrada`, con los nombres del contrato `CorreoFilaDto`. */
export interface CorreoEntradaFila {
  recibidoEn: string | null;
  de: string | null;
  para: string | null;
  asunto: string | null;
  messageId: string;
  hilo: string | null;
  adjunto: string | null;
  nuevoPedido: boolean | null;
  motivo: string | null;
  resultado: string | null;
  confianza: string | null;
  tipo: string | null;
  codigoOrdenVenta: string | null;
  idRegistro: string;
  registradoEn: string;
  actualizadoEn: string;
}

export interface FiltroCorreosEntrada {
  modo: ModoCorreos;
  pagina: number;
  tamano: number;
  desde?: string;
  hasta?: string;
  remitente?: string;
  asunto?: string;
}

export interface ListaCorreosEntrada {
  total: number;
  filas: CorreoEntradaFila[];
}

const iso = (columna: string) =>
  `to_char(${columna} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const COLUMNAS_ENTRADA = `
  ${iso('recibido_en')} AS "recibidoEn",
  de AS "de",
  para AS "para",
  asunto AS "asunto",
  message_id AS "messageId",
  hilo AS "hilo",
  adjunto AS "adjunto",
  nuevo_pedido AS "nuevoPedido",
  motivo AS "motivo",
  resultado AS "resultado",
  confianza AS "confianza",
  tipo AS "tipo",
  codigo_orden_venta AS "codigoOrdenVenta",
  id_correo_entrada::text AS "idRegistro",
  ${iso('created_at')} AS "registradoEn",
  ${iso('updated_at')} AS "actualizadoEn"`;

const contiene = (texto: string) =>
  `%${texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`;

const ingresadoAMano = (tablaIngresos: string) =>
  `EXISTS (SELECT 1 FROM ${tablaIngresos} i WHERE i.codigo_cuenta = $1 AND i.message_id = e.message_id AND i.estado = 'ingresado')`;

/** El WHERE de la lista de correos, sobre `correo_pedido_entrada` con alias `e`. `$1` es siempre la cuenta. */
export function armarFiltroEntradas(
  codigoCuenta: string,
  filtro: FiltroCorreosEntrada,
  tablaIngresos: string,
): { donde: string; params: unknown[] } {
  const params: unknown[] = [codigoCuenta];
  const condiciones = ['codigo_cuenta = $1'];
  const agregar = (condicion: (marcador: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(condicion(`$${params.length}`));
  };
  if (filtro.modo === 'descartados')
    condiciones.push(
      `nuevo_pedido = false AND NOT ${ingresadoAMano(tablaIngresos)}`,
    );
  if (filtro.modo === 'procesados')
    condiciones.push(
      `(nuevo_pedido IS DISTINCT FROM false OR ${ingresadoAMano(tablaIngresos)})`,
    );
  if (filtro.desde) {
    agregar((p) => `recibido_en >= ${p}::timestamptz`, filtro.desde);
  }
  if (filtro.hasta) {
    agregar((p) => `recibido_en <= ${p}::timestamptz`, filtro.hasta);
  }
  if (filtro.remitente) {
    agregar((p) => `de ILIKE ${p} ESCAPE '\\'`, contiene(filtro.remitente));
  }
  if (filtro.asunto) {
    agregar((p) => `asunto ILIKE ${p} ESCAPE '\\'`, contiene(filtro.asunto));
  }
  return { donde: condiciones.join(' AND '), params };
}
