import { Module } from '@nestjs/common';
import { ConfiguradorUsuariosController } from './controllers/configurador-usuarios.controller';
import { ConfiguradorUsuarioRepository } from './infrastructure/configurador-usuario.repository';
import { ConfiguradorUsuariosService } from './services/configurador-usuarios.service';

@Module({
  controllers: [ConfiguradorUsuariosController],
  providers: [ConfiguradorUsuariosService, ConfiguradorUsuarioRepository],
})
export class ConfiguratorModule {}
