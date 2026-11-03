import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { OpenAiReagrupacionClient } from './ai/openai-reagrupacion.client';
import { CorreoDescartadoController } from './controllers/correo-descartado.controller';
import { OrdenCorreoRelecturaController } from './controllers/orden-correo-relectura.controller';
import { OrdenTrabajoReagrupacionController } from './controllers/orden-trabajo-reagrupacion.controller';
import { OrdenVentaController } from './controllers/orden-venta.controller';
import { PedidoIaController } from './controllers/pedido-ia.controller';
import { PedidoIaApiKeyGuard } from './guards/pedido-ia-api-key.guard';
import { CorreoIngresoRepository } from './infrastructure/correo-ingreso.repository';
import { N8nCorreosClient } from './infrastructure/n8n-correos.client';
import { OrdenVentaRepository } from './infrastructure/orden-venta.repository';
import { CorreoDescartadoService } from './services/correo-descartado.service';
import { OrdenCorreoRelecturaService } from './services/orden-correo-relectura.service';
import { OrdenTrabajoReagrupacionService } from './services/orden-trabajo-reagrupacion.service';
import { OrdenVentaService } from './services/orden-venta.service';
import { PedidoIaService } from './services/pedido-ia.service';

@Module({
  imports: [OperationsModule],
  controllers: [
    OrdenVentaController,
    PedidoIaController,
    OrdenTrabajoReagrupacionController,
    OrdenCorreoRelecturaController,
    CorreoDescartadoController,
  ],
  providers: [
    CorreoDescartadoService,
    CorreoIngresoRepository,
    N8nCorreosClient,
    OrdenVentaService,
    OrdenVentaRepository,
    PedidoIaService,
    PedidoIaApiKeyGuard,
    OpenAiReagrupacionClient,
    OrdenTrabajoReagrupacionService,
    OrdenCorreoRelecturaService,
  ],
  exports: [PedidoIaService],
})
export class SalesModule {}
