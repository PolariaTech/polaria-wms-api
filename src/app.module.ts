import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthCoreModule } from './core/auth/auth-core.module';
import { GuardsModule } from './core/guards/guards.module';
import { AppConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfiguratorModule } from './modules/configurator/configurator.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, AuthCoreModule, GuardsModule, AuthModule, ConfiguratorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
