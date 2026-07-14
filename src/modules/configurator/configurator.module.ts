import { Module } from '@nestjs/common';
import { AdministracionUsuariosController } from './controllers/administracion-usuarios.controller';
import { ConfiguradorUsuariosController } from './controllers/configurador-usuarios.controller';
import { ConfiguradorUsuarioRepository } from './infrastructure/configurador-usuario.repository';
import { AdministracionUsuariosService } from './services/administracion-usuarios.service';
import { ConfiguradorUsuariosService } from './services/configurador-usuarios.service';

@Module({
  controllers: [
    ConfiguradorUsuariosController,
    AdministracionUsuariosController,
  ],
  providers: [
    ConfiguradorUsuariosService,
    AdministracionUsuariosService,
    ConfiguradorUsuarioRepository,
  ],
})
export class ConfiguratorModule {}
