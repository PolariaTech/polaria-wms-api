import { Module } from '@nestjs/common';
import {
  AlertaOperativaController,
  BodegaReportesController,
  LlamadaOperativaController,
  OrdenTrabajoController,
  TareaColaController,
} from './controllers/operations.controller';
import { AlertaOperativaRepository } from './infrastructure/alerta-operativa.repository';
import { BodegaReportesRepository } from './infrastructure/bodega-reportes.repository';
import { OrdenTrabajoRepository } from './infrastructure/orden-trabajo.repository';
import { TareaColaRepository } from './infrastructure/tarea-cola.repository';
import { BodegaReportesService } from './services/bodega-reportes.service';
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
  ],
  exports: [TareaColaRepository],
})
export class OperationsModule {}
