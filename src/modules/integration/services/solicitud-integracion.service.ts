import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { applyTenantFilter } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { isConfigurador } from '../../../shared/constants/roles';
import {
  mapTipoIntegracionToFlags,
  resolveTipoIntegracionFromFlags,
} from '../constants/integration.constants';
import { CreateSolicitudIntegracionDto } from '../dto/create-solicitud-integracion.dto';
import { SolicitudIntegracionRepository } from '../infrastructure/solicitud-integracion.repository';
import type { SolicitudIntegracionResponse } from '../interfaces/solicitud-integracion.interfaces';

@Injectable()
export class SolicitudIntegracionService {
  constructor(private readonly repository: SolicitudIntegracionRepository) {}

  async create(
    dto: CreateSolicitudIntegracionDto,
    ctx: TenantContext,
  ): Promise<SolicitudIntegracionResponse> {
    const codigoCuenta = (dto.codigoCuenta ?? ctx.codigoCuenta ?? '').trim();
    const bodegaExternaId = dto.bodegaExternaId.trim();
    const bodegaExternaNombre = dto.bodegaExternaNombre.trim();

    if (!codigoCuenta) {
      throw new BadRequestException('No se encontró la cuenta activa');
    }

    this.assertCuentaTenantScope(ctx, codigoCuenta);

    if (!bodegaExternaId || !bodegaExternaNombre) {
      throw new BadRequestException('Selecciona una bodega externa válida');
    }

    const bodega = await this.repository.findBodegaExterna(
      bodegaExternaId,
      codigoCuenta,
    );

    if (!bodega) {
      throw new NotFoundException(
        'La bodega externa no existe o no pertenece a la cuenta',
      );
    }

    const idCliente = await this.resolveClienteId(dto.idCliente, codigoCuenta);

    const flags = mapTipoIntegracionToFlags(dto.tipoIntegracion);

    const created = await this.repository.create({
      codigoCuenta,
      idCliente,
      bodegaExternaId: bodega.idBodega,
      bodegaExternaNombre: bodega.nombre,
      ...flags,
      idSolicitante: ctx.idUsuario,
    });

    return this.toResponse(created, true);
  }

  async listForTenant(
    ctx: TenantContext,
  ): Promise<SolicitudIntegracionResponse[]> {
    const where = applyTenantFilter({}, ctx);
    const rows = await this.repository.list(where);
    return rows.map((row) => this.toResponse(row));
  }

  async listForConfigurador(): Promise<SolicitudIntegracionResponse[]> {
    const rows = await this.repository.list({}, true);
    return rows.map((row) => this.toResponse(row, true));
  }

  private async resolveClienteId(
    idClienteDto: string | undefined,
    codigoCuenta: string,
  ): Promise<string> {
    const idCliente = idClienteDto?.trim();

    if (idCliente) {
      const cliente = await this.repository.findClienteActivo(
        idCliente,
        codigoCuenta,
      );

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado en la cuenta');
      }

      return cliente.idCliente;
    }

    const cliente = await this.repository.findFirstClienteActivo(codigoCuenta);

    if (!cliente) {
      throw new BadRequestException(
        'No hay clientes activos en la cuenta para registrar la solicitud',
      );
    }

    return cliente.idCliente;
  }

  private assertCuentaTenantScope(
    ctx: TenantContext,
    codigoCuenta: string,
  ): void {
    if (isConfigurador(ctx.idRol)) {
      return;
    }

    if (!ctx.codigoCuenta || ctx.codigoCuenta !== codigoCuenta) {
      throw new ForbiddenException(
        'La cuenta indicada no pertenece a su contexto de tenant',
      );
    }
  }

  private toResponse(
    row: {
      idSolicitudIntegracion: string;
      codigoCuenta: string;
      bodegaExternaId: string;
      bodegaExternaNombre: string;
      scraping: boolean;
      api: boolean;
      csvPlano: boolean;
      estado: SolicitudIntegracionResponse['estado'];
      createdAt: Date;
      cuenta?: { nombreComercial: string };
    },
    includeCuentaNombre = false,
  ): SolicitudIntegracionResponse {
    return {
      idSolicitudIntegracion: row.idSolicitudIntegracion,
      codigoCuenta: row.codigoCuenta,
      ...(includeCuentaNombre
        ? {
            cuentaNombre:
              row.cuenta?.nombreComercial?.trim() || row.codigoCuenta,
          }
        : {}),
      bodegaExternaId: row.bodegaExternaId,
      bodegaNombre: row.bodegaExternaNombre?.trim() || '—',
      tipoIntegracion: resolveTipoIntegracionFromFlags({
        scraping: row.scraping,
        api: row.api,
        csvPlano: row.csvPlano,
      }),
      estado: row.estado,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
