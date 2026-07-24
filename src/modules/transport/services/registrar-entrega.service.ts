import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { RegistrarEntregaDto } from '../dto/registrar-entrega.dto';
import { RegistrarEntregaRepository } from '../infrastructure/registrar-entrega.repository';
import type { RegistrarEntregaResponse } from '../interfaces/entrega.interfaces';

@Injectable()
export class RegistrarEntregaService {
  constructor(private readonly repository: RegistrarEntregaRepository) {}

  async registrar(
    dto: RegistrarEntregaDto,
    ctx: TenantContext,
  ): Promise<RegistrarEntregaResponse> {
    const codigoCuenta = dto.codigoCuenta.trim();
    const idBodega = dto.idBodega.trim();

    if (!ctx.idUsuario?.trim()) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!dto.entregaConforme && !dto.descripcionIncidencia?.trim()) {
      throw new BadRequestException(
        'Si la entrega no es conforme, describí el motivo',
      );
    }

    assertOperationalTenantScope(ctx, { codigoCuenta, idBodega });

    try {
      return await this.repository.registrar({
        codigoCuenta,
        idBodega,
        idViaje: dto.idViaje,
        idGuia: dto.idGuia,
        idOrdenVenta: dto.idOrdenVenta,
        entregaConforme: dto.entregaConforme,
        descripcionIncidencia: dto.descripcionIncidencia,
        evidenciaFotoUrl: dto.evidenciaFotoUrl.trim(),
        evidenciaFirmaUrl: dto.evidenciaFirmaUrl.trim(),
        lineas: dto.lineas.map((linea) => ({
          idLineaOrdenVenta: linea.idLineaOrdenVenta,
          cantidadEntregada: linea.cantidadEntregada,
        })),
        idUsuario: ctx.idUsuario,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    const code = error instanceof Error ? error.message : 'ENTREGA_FAILED';

    switch (code) {
      case 'VIAJE_NO_ENCONTRADO':
        return new NotFoundException('Viaje no encontrado');
      case 'GUIA_NO_ENCONTRADA':
        return new NotFoundException('Guía de envío no encontrada');
      case 'OV_NO_ENCONTRADA':
        return new NotFoundException('Orden de venta no encontrada');
      case 'VIAJE_ESTADO_INVALIDO':
        return new ConflictException(
          'El viaje no está en un estado entregable',
        );
      case 'GUIA_YA_ENTREGADA':
        return new ConflictException('Esta guía ya fue entregada');
      case 'OV_YA_CERRADA':
        return new ConflictException('La orden de venta ya está cerrada');
      case 'LINEAS_INCOMPLETAS':
        return new BadRequestException(
          'Debés indicar la cantidad entregada de todas las líneas',
        );
      case 'LINEA_INVALIDA':
        return new BadRequestException(
          'Una línea de entrega no pertenece a la venta',
        );
      default:
        return error instanceof Error
          ? error
          : new BadRequestException('No se pudo registrar la entrega');
    }
  }
}
