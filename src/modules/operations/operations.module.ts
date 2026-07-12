import { Module } from '@nestjs/common';
import {
  AlertaOperativaController,
  BodegaReportesController,
  LlamadaOperativaController,
  OperariosController,
  OrdenTrabajoController,
  PresenciaController,
  TareaColaController,
} from './controllers/operations.controller';
import { AlertaOperativaRepository } from './infrastructure/alerta-operativa.repository';
import { BodegaReportesRepository } from './infrastructure/bodega-reportes.repository';
import { OperariosRepository } from './infrastructure/operarios.repository';
import { OrdenTrabajoRepository } from './infrastructure/orden-trabajo.repository';
import { SesionOperativaRepository } from './infrastructure/sesion-operativa.repository';
import { TareaColaRepository } from './infrastructure/tarea-cola.repository';
import { BodegaReportesService } from './services/bodega-reportes.service';
import { OperariosService } from './services/operarios.service';
import {
  AlertaOperativaService,
  LlamadaOperativaService,
  OrdenTrabajoService,
  TareaColaService,
} from './services/operations.service';

@Module({
  controllers: [
    OrdenTrabajoController,
    TareaColaController,
    AlertaOperativaController,
    LlamadaOperativaController,
    BodegaReportesController,
    OperariosController,
    PresenciaController,
  ],
  providers: [
    OrdenTrabajoService,
    OrdenTrabajoRepository,
    TareaColaService,
    TareaColaRepository,
    AlertaOperativaService,
    AlertaOperativaRepository,
    LlamadaOperativaService,
    BodegaReportesService,
    BodegaReportesRepository,
    OperariosService,
    OperariosRepository,
    SesionOperativaRepository,
  ],
  exports: [TareaColaRepository, OrdenTrabajoRepository],
})
export class OperationsModule {}
