import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodegaTipo, Prisma, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { ROL_PLATAFORMA } from '../../../shared/constants/roles';
import { resolveCapacidadSlots } from '../constants/warehouse-layout.constants';
import { CreateBodegaDto } from '../dto/create-bodega.dto';
import { BodegaRepository } from '../infrastructure/bodega.repository';
import type { CreateBodegaResult } from '../interfaces/bodega.interfaces';

@Injectable()
export class BodegaService {
  constructor(private readonly bodegaRepository: BodegaRepository) {}

  async create(
    dto: CreateBodegaDto,
    ctx: TenantContext,
  ): Promise<CreateBodegaResult> {
    const codigo = dto.codigo.trim();
    const nombre = dto.nombre.trim();
    const codigoCuenta = this.resolveCodigoCuenta(dto.codigoCuenta, ctx);

    if (!codigo) {
      throw new BadRequestException('El código de la bodega es obligatorio');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre de la bodega es obligatorio');
    }

    const capacidadSlots = this.resolveCapacidadSlots(
      dto.tipo,
      dto.capacidadSlots,
    );

    const cuenta = await this.assertCuentaActiva(codigoCuenta);
    this.assertTenantAccess(codigoCuenta, ctx);

    try {
      return await this.bodegaRepository.createBodega({
        codigoCuenta,
        codigo,
        nombre,
        tipo: dto.tipo,
        capacidadSlots,
        idCreador: ctx.idUsuario,
        // null = public (legacy); emp_* para schema-per-empresa.
        schemaName: cuenta.schemaName ?? ctx.schemaName ?? null,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una bodega con ese código en la cuenta',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'La cuenta no existe en el schema de la empresa (FK bodega→cuenta).',
        );
      }
      // INSERT raw: el adapter a veces no mapea a P2002/P2003.
      const rawMessage =
        error instanceof Error ? error.message : String(error ?? '');
      if (/unique|duplicate key|bodega_codigo_cuenta_codigo/i.test(rawMessage)) {
        throw new ConflictException(
          'Ya existe una bodega con ese código en la cuenta',
        );
      }
      if (/fk_bodega_cuenta|codigo_cuenta/i.test(rawMessage)) {
        throw new BadRequestException(
          'La cuenta no existe en el schema de la empresa (FK bodega→cuenta).',
        );
      }
      if (/fk_bodega_creador|id_creador/i.test(rawMessage)) {
        throw new BadRequestException(
          'El usuario creador no existe en public.usuario (FK bodega→usuario).',
        );
      }
      throw error;
    }
  }

  private resolveCodigoCuenta(
    codigoCuentaDto: string | undefined,
    ctx: TenantContext,
  ): string {
    const codigoCuentaBody = codigoCuentaDto?.trim() || null;

    if (ctx.idRol === ROL_PLATAFORMA) {
      if (!codigoCuentaBody) {
        throw new BadRequestException(
          'codigoCuenta es obligatorio para el configurador',
        );
      }
      return codigoCuentaBody;
    }

    if (ctx.idRol === WmsRol.administrador_cuenta) {
      if (!ctx.codigoCuenta) {
        throw new ForbiddenException(
          'El administrador no tiene cuenta activa en el contexto',
        );
      }

      if (codigoCuentaBody && codigoCuentaBody !== ctx.codigoCuenta) {
        throw new ForbiddenException('No puede crear bodegas para otra cuenta');
      }

      return ctx.codigoCuenta;
    }

    throw new ForbiddenException('No tiene permisos para crear bodegas');
  }

  private resolveCapacidadSlots(
    tipo: BodegaTipo,
    capacidadSlots: number | undefined,
  ): number | null {
    if (tipo === BodegaTipo.interna) {
      if (capacidadSlots == null) {
        throw new BadRequestException(
          'capacidadSlots es obligatorio para bodegas internas',
        );
      }
      return resolveCapacidadSlots(capacidadSlots);
    }

    if (capacidadSlots == null) {
      return null;
    }

    return resolveCapacidadSlots(capacidadSlots);
  }

  private async assertCuentaActiva(
    codigoCuenta: string,
  ): Promise<NonNullable<Awaited<ReturnType<BodegaRepository['findCuenta']>>>> {
    const cuenta = await this.bodegaRepository.findCuenta(codigoCuenta);

    if (!cuenta) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    if (!cuenta.empresa.estaActiva) {
      throw new ForbiddenException('La empresa está inactiva');
    }

    if (!cuenta.estaActiva) {
      throw new ForbiddenException('La cuenta está inactiva');
    }

    return cuenta;
  }

  private assertTenantAccess(
    codigoCuentaBodega: string,
    ctx: TenantContext,
  ): void {
    if (ctx.idRol === ROL_PLATAFORMA) {
      return;
    }

    if (ctx.idRol === WmsRol.administrador_cuenta) {
      if (!ctx.codigoCuenta || ctx.codigoCuenta !== codigoCuentaBodega) {
        throw new ForbiddenException(
          'La bodega no pertenece a la cuenta del administrador',
        );
      }
      return;
    }

    throw new ForbiddenException('No tiene permisos para esta operación');
  }
}
