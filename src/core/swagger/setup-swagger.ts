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
    .setVersion('2.8.20')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido en POST /auth/login',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description:
          'Clave de integración IA (env PEDIDO_IA_API_KEY). Para POST /ventas/leer-pedido y /ventas/ai/extraer-archivos.',
      },
      'pedido-ia-api-key',
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
