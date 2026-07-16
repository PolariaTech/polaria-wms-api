import { Module } from '@nestjs/common';
import { PaqueteDespachoController } from './controllers/paquete-despacho.controller';
import { RegistrarEntregaController } from './controllers/registrar-entrega.controller';
import { PaqueteDespachoRepository } from './infrastructure/paquete-despacho.repository';
import { RegistrarEntregaRepository } from './infrastructure/registrar-entrega.repository';
import { PaqueteDespachoService } from './services/paquete-despacho.service';
import { RegistrarEntregaService } from './services/registrar-entrega.service';

@Module({
  controllers: [PaqueteDespachoController, RegistrarEntregaController],
  providers: [
    PaqueteDespachoService,
    PaqueteDespachoRepository,
    RegistrarEntregaService,
    RegistrarEntregaRepository,
  ],
})
export class TransportModule {}
