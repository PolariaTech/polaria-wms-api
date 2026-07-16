import { Module } from '@nestjs/common';
import { BodegaController } from './controllers/bodega.controller';
import { BodegaLayoutController } from './controllers/bodega-layout.controller';
import { CuentaController } from './controllers/cuenta.controller';
import { EmpresaController } from './controllers/empresa.controller';
import { BodegaRepository } from './infrastructure/bodega.repository';
import { BodegaLayoutRepository } from './infrastructure/bodega-layout.repository';
import { CuentaRepository } from './infrastructure/cuenta.repository';
import { EmpresaRepository } from './infrastructure/empresa.repository';
import { BodegaService } from './services/bodega.service';
import { BodegaLayoutBootstrapService } from './services/bodega-layout-bootstrap.service';
import { CuentaService } from './services/cuenta.service';
import { EmpresaService } from './services/empresa.service';

@Module({
  controllers: [
    BodegaController,
    BodegaLayoutController,
    EmpresaController,
    CuentaController,
  ],
  providers: [
    BodegaService,
    BodegaRepository,
    BodegaLayoutBootstrapService,
    BodegaLayoutRepository,
    EmpresaService,
    EmpresaRepository,
    CuentaService,
    CuentaRepository,
  ],
})
export class ConfiguracionModule {}
