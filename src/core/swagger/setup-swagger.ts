import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_CLIENT_HEADER } from '../../shared/constants/auth-client.constants';
import {
  SWAGGER_TAG_DESCRIPTIONS,
  SWAGGER_TAG_ORDER,
} from './swagger.constants';

export function setupSwagger(app: INestApplication): void {
  let builder = new DocumentBuilder()
    .setTitle('Polaria WMS API')
    .setDescription(
      'API backend del sistema de gestión de almacenes (WMS) de Polaria. ' +
        'Los endpoints están agrupados por dominio y rol requerido. ' +
        'Integración con chatbot Mateo (handoff SSO y login por cliente). ' +
        `Header opcional \`${AUTH_CLIENT_HEADER}\`: \`wms\` (correo) | \`mateo\` (username).`,
    )
    .setVersion('2.7.5')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido en POST /auth/login',
      },
      'access-token',
    );

  for (const tag of SWAGGER_TAG_ORDER) {
    builder = builder.addTag(tag, SWAGGER_TAG_DESCRIPTIONS[tag]);
  }

  const swaggerConfig = builder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      docExpansion: 'list',
      operationsSorter: 'alpha',
    },
  });
}
