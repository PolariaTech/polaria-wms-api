import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { CreateEmpresaDto } from '../dto/create-empresa.dto';
import { CreateEmpresaResponseDto } from '../dto/create-empresa-response.dto';
import { UpdateEmpresaDto } from '../dto/update-empresa.dto';
import { UpdateEmpresaResponseDto } from '../dto/update-empresa-response.dto';
import type {
  CreateEmpresaResult,
  UpdateEmpresaResult,
} from '../interfaces/empresa.interfaces';
import { EmpresaService } from '../services/empresa.service';

@ApiTags(SWAGGER_TAGS.CONFIGURACION_EMPRESAS)
@Controller('configuracion/empresas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear empresa + provisionar schema emp_*',
    description:
      'Inserta la empresa en public y crea el schema Postgres con todas las tablas de negocio (template_wms). Solo configurador.',
  })
  @ApiCreatedResponse({ type: CreateEmpresaResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo configurador puede crear empresas',
  })
  @ApiConflictResponse({ description: 'Código de empresa ya existe' })
  create(@Body() dto: CreateEmpresaDto): Promise<CreateEmpresaResult> {
    return this.empresaService.create(dto);
  }

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
