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
import { UpdateEmpresaDto } from '../dto/update-empresa.dto';
import { UpdateEmpresaResponseDto } from '../dto/update-empresa-response.dto';
import type { UpdateEmpresaResult } from '../interfaces/empresa.interfaces';
import { EmpresaService } from '../services/empresa.service';

@ApiTags(SWAGGER_TAGS.CONFIGURACION_EMPRESAS)
@Controller('configuracion/empresas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Patch(':codigoEmpresa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar empresa',
    description:
      'Actualiza razón social, teléfono y/o estado (estaActiva). ' +
      'Solo rol configurador. El código de empresa no se modifica.',
  })
  @ApiParam({
    name: 'codigoEmpresa',
    example: 'EVU53',
    description: 'Código PK de la empresa',
  })
  @ApiOkResponse({ type: UpdateEmpresaResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo configurador puede actualizar empresas',
  })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada' })
  update(
    @Param('codigoEmpresa') codigoEmpresa: string,
    @Body() dto: UpdateEmpresaDto,
  ): Promise<UpdateEmpresaResult> {
    return this.empresaService.update(codigoEmpresa, dto);
  }
}
