import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { OrdenVentaController } from './controllers/orden-venta.controller';
import { PedidoIaController } from './controllers/pedido-ia.controller';
import { PedidoIaApiKeyGuard } from './guards/pedido-ia-api-key.guard';
import { OrdenVentaRepository } from './infrastructure/orden-venta.repository';
import { OrdenVentaService } from './services/orden-venta.service';
import { PedidoIaService } from './services/pedido-ia.service';

@Module({
  imports: [OperationsModule],
  controllers: [OrdenVentaController, PedidoIaController],
  providers: [
    OrdenVentaService,
    OrdenVentaRepository,
    PedidoIaService,
    PedidoIaApiKeyGuard,
  ],
  exports: [PedidoIaService],
})
export class SalesModule {}
