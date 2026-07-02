import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodegaTipo, Prisma } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
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
    const codigoCuenta = dto.codigoCuenta?.trim();

    if (!codigoCuenta) {
      throw new BadRequestException('codigoCuenta es obligatorio');
    }

    if (!codigo) {
      throw new BadRequestException('El código de la bodega es obligatorio');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre de la bodega es obligatorio');
    }

    const capacidadSlots = this.resolveCapacidadSlots(dto.tipo, dto.capacidadSlots);

    await this.assertCuentaActiva(codigoCuenta);

    try {
      return await this.bodegaRepository.createBodega({
        codigoCuenta,
        codigo,
        nombre,
        tipo: dto.tipo,
        capacidadSlots,
        idCreador: ctx.idUsuario,
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
      throw error;
    }
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

  private async assertCuentaActiva(codigoCuenta: string): Promise<void> {
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
  }
}
