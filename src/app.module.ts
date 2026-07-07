import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthCoreModule } from './core/auth/auth-core.module';
import { GuardsModule } from './core/guards/guards.module';
import { AppConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfiguratorModule } from './modules/configurator/configurator.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ProcessingModule } from './modules/processing/processing.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthCoreModule,
    GuardsModule,
    AuthModule,
    ConfiguratorModule,
    ConfiguracionModule,
    IntegrationModule,
    PurchasesModule,
    InventoryModule,
    OperationsModule,
    ProcessingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
