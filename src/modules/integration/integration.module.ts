import { Module } from '@nestjs/common';
import {
  ConfiguradorIntegracionController,
  SolicitudIntegracionController,
} from './controllers/solicitud-integracion.controller';
import { SolicitudIntegracionRepository } from './infrastructure/solicitud-integracion.repository';
import { SolicitudIntegracionService } from './services/solicitud-integracion.service';

@Module({
  controllers: [
    SolicitudIntegracionController,
    ConfiguradorIntegracionController,
  ],
  providers: [SolicitudIntegracionService, SolicitudIntegracionRepository],
})
export class IntegrationModule {}
