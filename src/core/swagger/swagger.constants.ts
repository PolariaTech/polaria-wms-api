/** Etiquetas Swagger agrupadas por dominio y rol. */
export const SWAGGER_TAGS = {
  AUTH: 'Autenticación',
  USUARIOS_CONFIGURADOR: 'Usuarios · Configurador',
  USUARIOS_ADMIN_CUENTA: 'Usuarios · Admin cuenta',
  CONFIGURACION_BODEGAS: 'Configuración · Bodegas',
  COMPRAS_SOL: 'Compras · Solicitudes (SOL)',
  COMPRAS_OC: 'Compras · Órdenes (OC)',
  SISTEMA: 'Sistema',
} as const;

export type SwaggerTag = (typeof SWAGGER_TAGS)[keyof typeof SWAGGER_TAGS];

export const SWAGGER_TAG_ORDER: readonly SwaggerTag[] = [
  SWAGGER_TAGS.AUTH,
  SWAGGER_TAGS.USUARIOS_CONFIGURADOR,
  SWAGGER_TAGS.USUARIOS_ADMIN_CUENTA,
  SWAGGER_TAGS.CONFIGURACION_BODEGAS,
  SWAGGER_TAGS.COMPRAS_SOL,
  SWAGGER_TAGS.COMPRAS_OC,
  SWAGGER_TAGS.SISTEMA,
];

export const SWAGGER_TAG_DESCRIPTIONS: Record<SwaggerTag, string> = {
  [SWAGGER_TAGS.AUTH]:
    'Login, prelogin, perfil y handoff SSO con Mateo. Endpoints públicos y autenticados.',
  [SWAGGER_TAGS.USUARIOS_CONFIGURADOR]:
    'Alta de usuarios en cualquier tenant. Rol requerido: configurador (scope plataforma).',
  [SWAGGER_TAGS.USUARIOS_ADMIN_CUENTA]:
    'Alta de usuarios dentro del tenant activo. Rol requerido: administrador_cuenta (scope cuenta).',
  [SWAGGER_TAGS.CONFIGURACION_BODEGAS]:
    'Layout operativo de bodegas internas (tipos, zonas, slots). Roles: configurador o administrador_cuenta.',
  [SWAGGER_TAGS.COMPRAS_SOL]:
    'Solicitudes de compra (SOL): borrador, aprobación y ciclo de estados por tenant.',
  [SWAGGER_TAGS.COMPRAS_OC]:
    'Órdenes de compra (OC): creación, emisión, cancelación y conversión desde SOL.',
  [SWAGGER_TAGS.SISTEMA]: 'Health check y utilidades de la API.',
};
