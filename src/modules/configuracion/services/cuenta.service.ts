import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCuentaDto } from '../dto/update-cuenta.dto';
import { CuentaRepository } from '../infrastructure/cuenta.repository';
import type {
  UpdateCuentaData,
  UpdateCuentaResult,
} from '../interfaces/cuenta.interfaces';

@Injectable()
export class CuentaService {
  constructor(private readonly cuentaRepository: CuentaRepository) {}

  async update(
    codigoCuenta: string,
    dto: UpdateCuentaDto,
  ): Promise<UpdateCuentaResult> {
    const codigo = codigoCuenta.trim();
    if (!codigo) {
      throw new BadRequestException('El código de cuenta es obligatorio');
    }

    const data = this.buildUpdateData(dto);
    const syncBodegas = dto.idsBodegas !== undefined;
    const idsBodegasDeseadas = this.normalizeIdsBodegas(dto.idsBodegas);

    if (Object.keys(data).length === 0 && !syncBodegas) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }

    const existing = await this.cuentaRepository.findByCodigo(codigo);
    if (!existing) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    if (syncBodegas) {
      await this.syncBodegas(
        existing.codigoEmpresa,
        codigo,
        idsBodegasDeseadas,
        dto.codigoCuentaDestinoDesvinculacion,
      );
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    return this.cuentaRepository.update(codigo, data);
  }

  private buildUpdateData(dto: UpdateCuentaDto): UpdateCuentaData {
    const data: UpdateCuentaData = {};

    if (dto.nombreComercial !== undefined) {
      const nombreComercial = dto.nombreComercial.trim();
      if (!nombreComercial) {
        throw new BadRequestException('El nombre de la cuenta es obligatorio');
      }
      data.nombreComercial = nombreComercial;
    }

    if (dto.estaActiva !== undefined) {
      data.estaActiva = dto.estaActiva;
    }

    return data;
  }

  private normalizeIdsBodegas(ids: string[] | undefined): string[] {
    if (!ids?.length) return [];
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  }

  private async syncBodegas(
    codigoEmpresa: string,
    codigoCuenta: string,
    idsBodegasDeseadas: string[],
    codigoCuentaDestinoDto?: string,
  ): Promise<void> {
    const actuales =
      await this.cuentaRepository.findBodegasActivasDeCuenta(codigoCuenta);
    const actualesIds = new Set(actuales.map((item) => item.idBodega));
    const deseadasIds = new Set(idsBodegasDeseadas);

    const toAssign = idsBodegasDeseadas.filter((id) => !actualesIds.has(id));
    const toUnlink = [...actualesIds].filter((id) => !deseadasIds.has(id));

    if (toAssign.length > 0) {
      await this.assignBodegas(codigoEmpresa, codigoCuenta, toAssign);
    }

    if (toUnlink.length === 0) return;

    const destino = await this.resolveCuentaDestino(
      codigoEmpresa,
      codigoCuenta,
      codigoCuentaDestinoDto,
    );

    await this.cuentaRepository.assignBodegasToCuenta(destino, toUnlink);
  }

  private async resolveCuentaDestino(
    codigoEmpresa: string,
    codigoCuentaActual: string,
    codigoCuentaDestinoDto?: string,
  ): Promise<string> {
    const destinoDto = codigoCuentaDestinoDto?.trim() || '';
    const otras = await this.cuentaRepository.findOtrasCuentasEmpresa(
      codigoEmpresa,
      codigoCuentaActual,
    );

    if (destinoDto) {
      if (destinoDto === codigoCuentaActual) {
        throw new BadRequestException(
          'La cuenta destino de desvinculación debe ser distinta',
        );
      }
      const match = otras.find((item) => item.codigoCuenta === destinoDto);
      if (!match) {
        throw new BadRequestException(
          'La cuenta destino no pertenece a la misma empresa o está inactiva',
        );
      }
      return match.codigoCuenta;
    }

    if (otras[0]) {
      return otras[0].codigoCuenta;
    }

    throw new BadRequestException(
      'No puedes desvincular bodegas: no hay otra cuenta activa en la misma empresa a la cual moverlas.',
    );
  }

  private async assignBodegas(
    codigoEmpresa: string,
    codigoCuenta: string,
    idsBodegas: string[],
  ): Promise<void> {
    const bodegas = await this.cuentaRepository.findBodegasByIds(idsBodegas);

    if (bodegas.length !== idsBodegas.length) {
      throw new BadRequestException(
        'Una o más bodegas no existen o están inactivas',
      );
    }

    for (const bodega of bodegas) {
      if (bodega.cuenta.codigoEmpresa !== codigoEmpresa) {
        throw new BadRequestException(
          'Solo puedes designar bodegas de la misma empresa',
        );
      }
    }

    const toAssign = bodegas
      .filter((bodega) => bodega.codigoCuenta !== codigoCuenta)
      .map((bodega) => bodega.idBodega);

    if (toAssign.length > 0) {
      await this.cuentaRepository.assignBodegasToCuenta(codigoCuenta, toAssign);
    }
  }
}
