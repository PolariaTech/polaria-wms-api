import { Injectable } from '@nestjs/common';
import {
  EstadoGuiaEnvio,
  EstadoOrdenVenta,
  EstadoViajeTransporte,
  Prisma,
  TipoEvidenciaTransporte,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  RegistrarEntregaInput,
  RegistrarEntregaResponse,
} from '../interfaces/entrega.interfaces';
import { resolverResultadoEntrega } from '../utils/entrega-resultado.util';

const ESTADOS_VIAJE_ENTREGABLES: EstadoViajeTransporte[] = [
  EstadoViajeTransporte.programado,
  EstadoViajeTransporte.en_ruta,
];

@Injectable()
export class RegistrarEntregaRepository {
  constructor(private readonly prisma: PrismaService) {}

  registrar(input: RegistrarEntregaInput): Promise<RegistrarEntregaResponse> {
    const codigoCuenta = input.codigoCuenta.trim();
    const incidencia = input.entregaConforme
      ? null
      : input.descripcionIncidencia?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const viaje = await tx.viajeTransporte.findFirst({
        where: {
          idViaje: input.idViaje,
          codigoCuenta,
          idBodega: input.idBodega,
        },
      });

      if (!viaje) {
        throw new Error('VIAJE_NO_ENCONTRADO');
      }

      if (!ESTADOS_VIAJE_ENTREGABLES.includes(viaje.estado)) {
        throw new Error('VIAJE_ESTADO_INVALIDO');
      }

      const guia = await tx.guiaEnvio.findFirst({
        where: {
          idGuia: input.idGuia,
          idViaje: viaje.idViaje,
          idOrdenVenta: input.idOrdenVenta,
          codigoCuenta,
        },
      });

      if (!guia) {
        throw new Error('GUIA_NO_ENCONTRADA');
      }

      if (guia.estado === EstadoGuiaEnvio.entregada) {
        throw new Error('GUIA_YA_ENTREGADA');
      }

      const orden = await tx.ordenVenta.findFirst({
        where: {
          idOrdenVenta: input.idOrdenVenta,
          codigoCuenta,
          idBodega: input.idBodega,
        },
        include: { lineas: true },
      });

      if (!orden) {
        throw new Error('OV_NO_ENCONTRADA');
      }

      if (orden.estado === EstadoOrdenVenta.cerrada) {
        throw new Error('OV_YA_CERRADA');
      }

      const lineasById = new Map(
        orden.lineas.map((linea) => [linea.idLineaOrdenVenta, linea]),
      );

      if (input.lineas.length !== orden.lineas.length) {
        throw new Error('LINEAS_INCOMPLETAS');
      }

      const entregas: Array<{
        idLineaOrdenVenta: string;
        cantidadEsperada: Prisma.Decimal;
        cantidadEntregada: number;
      }> = [];

      for (const lineaIn of input.lineas) {
        const linea = lineasById.get(lineaIn.idLineaOrdenVenta);
        if (!linea) {
          throw new Error('LINEA_INVALIDA');
        }
        entregas.push({
          idLineaOrdenVenta: linea.idLineaOrdenVenta,
          cantidadEsperada: linea.cantidadPedida,
          cantidadEntregada: lineaIn.cantidadEntregada,
        });
      }

      const resultado = resolverResultadoEntrega(
        entregas,
        input.entregaConforme,
      );

      for (const entrega of entregas) {
        await tx.evidenciaTransporte.create({
          data: {
            idGuia: guia.idGuia,
            idLineaOrdenVenta: entrega.idLineaOrdenVenta,
            tipo: TipoEvidenciaTransporte.foto,
            urlCloudinary: input.evidenciaFotoUrl,
            cantidadEntregada: new Prisma.Decimal(entrega.cantidadEntregada),
            incidencia,
            entregaConforme: input.entregaConforme,
          },
        });
      }

      await tx.evidenciaTransporte.create({
        data: {
          idGuia: guia.idGuia,
          tipo: TipoEvidenciaTransporte.firma,
          urlCloudinary: input.evidenciaFirmaUrl,
          incidencia,
          entregaConforme: input.entregaConforme,
        },
      });

      await tx.guiaEnvio.update({
        where: { idGuia: guia.idGuia },
        data: { estado: EstadoGuiaEnvio.entregada },
      });

      const observacionBase = viaje.observaciones?.trim() ?? '';
      const resultadoLabel =
        resultado === 'ok' ? 'Cerrado(ok)' : 'Cerrado(no ok)';
      const observaciones = [observacionBase, `Entrega ${resultadoLabel}`]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 2000);

      const viajeActualizado = await tx.viajeTransporte.update({
        where: { idViaje: viaje.idViaje },
        data: {
          estado: EstadoViajeTransporte.entregado,
          fechaSalida: viaje.fechaSalida ?? new Date(),
          fechaCierre: new Date(),
          idTransportista: input.idUsuario,
          observaciones,
        },
      });

      await tx.ordenVenta.update({
        where: { idOrdenVenta: orden.idOrdenVenta },
        data: { estado: EstadoOrdenVenta.cerrada },
      });

      if (viaje.idCamion) {
        const otrosActivos = await tx.viajeTransporte.count({
          where: {
            idCamion: viaje.idCamion,
            idViaje: { not: viaje.idViaje },
            estado: { in: ESTADOS_VIAJE_ENTREGABLES },
          },
        });

        if (otrosActivos === 0) {
          await tx.camion.update({
            where: { idCamion: viaje.idCamion },
            data: { disponible: true },
          });
        }
      }

      return {
        idViaje: viajeActualizado.idViaje,
        codigoViaje: viajeActualizado.codigo,
        idGuia: guia.idGuia,
        resultado,
        estadoViaje: viajeActualizado.estado,
        estadoVenta: EstadoOrdenVenta.cerrada,
      };
    });
  }
}
