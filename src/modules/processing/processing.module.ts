import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { SolicitudProcesamientoController } from './controllers/solicitud-procesamiento.controller';
import { ProcesamientoInventarioRepository } from './infrastructure/procesamiento-inventario.repository';
import { SolicitudProcesamientoRepository } from './infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from './services/solicitud-procesamiento.service';

@Module({
  imports: [OperationsModule],
  controllers: [SolicitudProcesamientoController],
  providers: [
    SolicitudProcesamientoService,
    SolicitudProcesamientoRepository,
    ProcesamientoInventarioRepository,
  ],
  exports: [SolicitudProcesamientoRepository],
})
export class ProcessingModule {}
