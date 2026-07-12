import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { OrdenVentaController } from './controllers/orden-venta.controller';
import { OrdenVentaRepository } from './infrastructure/orden-venta.repository';
import { OrdenVentaService } from './services/orden-venta.service';

@Module({
  imports: [OperationsModule],
  controllers: [OrdenVentaController],
  providers: [OrdenVentaService, OrdenVentaRepository],
})
export class SalesModule {}
