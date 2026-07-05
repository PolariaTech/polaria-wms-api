import { Module } from '@nestjs/common';
import { WarehouseStateController } from './controllers/warehouse-state.controller';
import { WarehouseStateRepository } from './infrastructure/warehouse-state.repository';
import { WarehouseStateService } from './services/warehouse-state.service';

@Module({
  controllers: [WarehouseStateController],
  providers: [WarehouseStateService, WarehouseStateRepository],
})
export class InventoryModule {}
