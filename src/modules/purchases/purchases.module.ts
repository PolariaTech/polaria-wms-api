import { Module } from '@nestjs/common';
import { OrdenCompraController } from './controllers/orden-compra.controller';
import { RecepcionCompraController } from './controllers/recepcion-compra.controller';
import { SolicitudCompraController } from './controllers/solicitud-compra.controller';
import { OrdenCompraRepository } from './infrastructure/orden-compra.repository';
import { RecepcionCompraRepository } from './infrastructure/recepcion-compra.repository';
import { SolicitudCompraRepository } from './infrastructure/solicitud-compra.repository';
import { OrdenCompraService } from './services/orden-compra.service';
import { RecepcionCompraService } from './services/recepcion-compra.service';
import { SolicitudCompraService } from './services/solicitud-compra.service';

@Module({
  controllers: [
    SolicitudCompraController,
    OrdenCompraController,
    RecepcionCompraController,
  ],
  providers: [
    SolicitudCompraService,
    SolicitudCompraRepository,
    OrdenCompraService,
    OrdenCompraRepository,
    RecepcionCompraService,
    RecepcionCompraRepository,
  ],
})
export class PurchasesModule {}
