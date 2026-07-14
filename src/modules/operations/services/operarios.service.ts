import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type {
  TenantBodegaBodyDto,
  TenantBodegaQueryDto,
} from '../dto/operations.dto';
import type { OperarioDisponibleResponse } from '../interfaces/operations.interfaces';
import { OperariosRepository } from '../infrastructure/operarios.repository';
import { SesionOperativaRepository } from '../infrastructure/sesion-operativa.repository';

@Injectable()
export class OperariosService {
  constructor(
    private readonly operariosRepository: OperariosRepository,
    private readonly sesionRepository: SesionOperativaRepository,
  ) {}

  async listDisponibles(
    query: TenantBodegaQueryDto,
    ctx: TenantContext,
  ): Promise<OperarioDisponibleResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    await this.assertBodegaEnCuenta(query.codigoCuenta, query.idBodega);

    const operarios = await this.operariosRepository.listOperariosEnBodega(
      query.codigoCuenta,
      query.idBodega,
    );

    const idUsuarios = operarios.map((o) => o.idUsuario);
    const [tareasPorOperario, sesiones] = await Promise.all([
      this.operariosRepository.countTareasPendientesPorOperario(
        query.codigoCuenta,
        query.idBodega,
        idUsuarios,
      ),
      this.sesionRepository.findByUsuarios(
        query.codigoCuenta,
        query.idBodega,
        idUsuarios,
      ),
    ]);

    const sesionesPorUsuario = new Map(sesiones.map((s) => [s.idUsuario, s]));

    const result = operarios.map((operario) => {
      const sesion = sesionesPorUsuario.get(operario.idUsuario);

      return {
        idUsuario: operario.idUsuario,
        nombre: operario.nombre,
        username: operario.username,
        tareasPendientes: tareasPorOperario.get(operario.idUsuario) ?? 0,
        disponible: operario.estaActivo,
        ultimoPing: sesion?.ultimoPing.toISOString() ?? null,
      };
    });

    result.sort((a, b) => {
      if (a.tareasPendientes !== b.tareasPendientes) {
        return a.tareasPendientes - b.tareasPendientes;
      }
      return a.nombre.localeCompare(b.nombre, 'es');
    });

    return result;
  }

  async ping(dto: TenantBodegaBodyDto, ctx: TenantContext): Promise<void> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const operario = await this.operariosRepository.findOperarioEnBodega(
      ctx.idUsuario,
      dto.codigoCuenta,
      dto.idBodega,
    );

    if (!operario) {
      throw new ForbiddenException(
        'No tienes asignación activa como operario en esta bodega',
      );
    }

    if (!operario.estaActivo) {
      throw new ForbiddenException('Tu cuenta de operario no está activa');
    }

    await this.sesionRepository.upsertPing(
      ctx.idUsuario,
      dto.codigoCuenta,
      dto.idBodega,
    );
  }

  async assertOperarioAsignable(
    idAsignado: string,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<void> {
    await this.assertBodegaEnCuenta(codigoCuenta, idBodega);

    const operario = await this.operariosRepository.findOperarioEnBodega(
      idAsignado,
      codigoCuenta,
      idBodega,
    );

    if (!operario) {
      throw new BadRequestException(
        'El operario no existe o no pertenece a esta bodega',
      );
    }

    if (!operario.estaActivo) {
      throw new BadRequestException('El operario no está activo en el sistema');
    }
  }

  private async assertBodegaEnCuenta(
    codigoCuenta: string,
    idBodega: string,
  ): Promise<void> {
    const bodega = await this.operariosRepository.findBodegaEnCuenta(
      codigoCuenta,
      idBodega,
    );

    if (!bodega) {
      throw new ForbiddenException(
        'La bodega no pertenece a la cuenta indicada',
      );
    }
  }
}
