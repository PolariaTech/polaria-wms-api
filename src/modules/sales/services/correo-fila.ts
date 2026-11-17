import type { CorreoFilaDto } from '../dto/correos-response.dto';
import type { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import type { CorreoEntradaFila } from '../infrastructure/correo-entrada.consultas';
import type { CorreoIngresoFila } from '../infrastructure/correo-ingreso.repository';

export function aIngresoDto(fila: CorreoIngresoFila): IngresoCorreoResponseDto {
  return {
    messageId: fila.messageId,
    estado: fila.estado,
    idOrdenVenta: fila.idOrdenVenta,
    codigoOrdenVenta: fila.codigoOrdenVenta,
    error: fila.error,
  };
}

export function conIngreso(
  fila: CorreoEntradaFila,
  ingreso: CorreoIngresoFila | undefined,
): CorreoFilaDto {
  return {
    ...fila,
    codigoOrdenVenta:
      fila.codigoOrdenVenta ??
      (ingreso?.estado === 'ingresado' ? ingreso.codigoOrdenVenta : null),
    ingreso: ingreso ? aIngresoDto(ingreso) : null,
  };
}
