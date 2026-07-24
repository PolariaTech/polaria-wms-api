import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WmsRol } from '../../../generated/prisma/client';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { UpdateCuentaDto } from '../dto/update-cuenta.dto';
import { UpdateCuentaResponseDto } from '../dto/update-cuenta-response.dto';
import type { UpdateCuentaResult } from '../interfaces/cuenta.interfaces';
import { CuentaService } from '../services/cuenta.service';

@ApiTags(SWAGGER_TAGS.CONFIGURACION_CUENTAS)
@Controller('configuracion/cuentas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class CuentaController {
  constructor(private readonly cuentaService: CuentaService) {}

  @Patch(':codigoCuenta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar cuenta comercial',
    description:
      'Actualiza nombre comercial, credenciales/acceso (estaActiva) y sincroniza ' +
      'bodegas (idsBodegas). Al desmarcar una bodega se mueve a otra cuenta de la ' +
      'misma empresa. Si estaActiva=false, los usuarios no pueden iniciar sesión. ' +
      'Rol: configurador.',
  })
  @ApiParam({
    name: 'codigoCuenta',
    example: '49M04',
    description: 'Código PK de la cuenta',
  })
  @ApiOkResponse({ type: UpdateCuentaResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo configurador puede actualizar cuentas',
  })
  @ApiNotFoundResponse({ description: 'Cuenta no encontrada' })
  update(
    @Param('codigoCuenta') codigoCuenta: string,
    @Body() dto: UpdateCuentaDto,
  ): Promise<UpdateCuentaResult> {
    return this.cuentaService.update(codigoCuenta, dto);
  }
}
