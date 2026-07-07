import { Module } from '@nestjs/common';
import { SolicitudProcesamientoController } from './controllers/solicitud-procesamiento.controller';
import { SolicitudProcesamientoRepository } from './infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from './services/solicitud-procesamiento.service';

@Module({
  controllers: [SolicitudProcesamientoController],
  providers: [SolicitudProcesamientoService, SolicitudProcesamientoRepository],
})
export class ProcessingModule {}
