import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuarioRepository } from './infrastructure/usuario.repository';
import { MateoHandoffService } from './mateo-handoff.service';
import { MateoWidgetTokenService } from './mateo-widget-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('MATEO_HANDOFF_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsuarioRepository,
    MateoHandoffService,
    MateoWidgetTokenService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
