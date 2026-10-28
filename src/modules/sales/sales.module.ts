import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { OpenAiReagrupacionClient } from './ai/openai-reagrupacion.client';
import { OrdenTrabajoReagrupacionController } from './controllers/orden-trabajo-reagrupacion.controller';
import { OrdenVentaController } from './controllers/orden-venta.controller';
import { PedidoIaController } from './controllers/pedido-ia.controller';
import { PedidoIaApiKeyGuard } from './guards/pedido-ia-api-key.guard';
import { OrdenVentaRepository } from './infrastructure/orden-venta.repository';
import { OrdenTrabajoReagrupacionService } from './services/orden-trabajo-reagrupacion.service';
import { OrdenVentaService } from './services/orden-venta.service';
import { PedidoIaService } from './services/pedido-ia.service';

@Module({
  imports: [OperationsModule],
  controllers: [
    OrdenVentaController,
    PedidoIaController,
    OrdenTrabajoReagrupacionController,
  ],
  providers: [
    OrdenVentaService,
    OrdenVentaRepository,
    PedidoIaService,
    PedidoIaApiKeyGuard,
    OpenAiReagrupacionClient,
    OrdenTrabajoReagrupacionService,
  ],
  exports: [PedidoIaService],
})
export class SalesModule {}
