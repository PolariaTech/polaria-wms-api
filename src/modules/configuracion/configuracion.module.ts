import { Module } from '@nestjs/common';
import { BodegaLayoutController } from './controllers/bodega-layout.controller';
import { BodegaLayoutRepository } from './infrastructure/bodega-layout.repository';
import { BodegaLayoutBootstrapService } from './services/bodega-layout-bootstrap.service';

@Module({
  controllers: [BodegaLayoutController],
  providers: [BodegaLayoutBootstrapService, BodegaLayoutRepository],
})
export class ConfiguracionModule {}
