import { Module } from '@nestjs/common';
import {
  AlertaOperativaController,
  LlamadaOperativaController,
  OrdenTrabajoController,
  TareaColaController,
} from './controllers/operations.controller';
import { AlertaOperativaRepository } from './infrastructure/alerta-operativa.repository';
import { OrdenTrabajoRepository } from './infrastructure/orden-trabajo.repository';
import { TareaColaRepository } from './infrastructure/tarea-cola.repository';
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
  ],
  providers: [
    OrdenTrabajoService,
    OrdenTrabajoRepository,
    TareaColaService,
    TareaColaRepository,
    AlertaOperativaService,
    AlertaOperativaRepository,
    LlamadaOperativaService,
  ],
  exports: [TareaColaRepository],
})
export class OperationsModule {}
