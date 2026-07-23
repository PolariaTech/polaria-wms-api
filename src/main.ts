import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { securityHeadersMiddleware } from './core/security/security-headers.middleware';
import { validateSecurityEnv } from './core/security/validate-security-env';
import { setupSwagger } from './core/swagger/setup-swagger';
import { AUTH_CLIENT_HEADER } from './shared/constants/auth-client.constants';

async function bootstrap() {
  validateSecurityEnv();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(securityHeadersMiddleware);

  const mateoOrigins = configService
    .getOrThrow<string>('MATEO_ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: mateoOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', AUTH_CLIENT_HEADER],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
