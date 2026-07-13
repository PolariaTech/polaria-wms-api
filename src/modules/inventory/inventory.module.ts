import { Module } from '@nestjs/common';
import { MovimientoInventarioController } from './controllers/movimiento-inventario.controller';
import { WarehouseStateController } from './controllers/warehouse-state.controller';
import { MovimientoInventarioRepository } from './infrastructure/movimiento-inventario.repository';
import { WarehouseStateRepository } from './infrastructure/warehouse-state.repository';
import { MovimientoInventarioService } from './services/movimiento-inventario.service';
import { WarehouseStateService } from './services/warehouse-state.service';

@Module({
  controllers: [WarehouseStateController, MovimientoInventarioController],
  providers: [
    WarehouseStateService,
    WarehouseStateRepository,
    MovimientoInventarioService,
    MovimientoInventarioRepository,
  ],
})
export class InventoryModule {}
