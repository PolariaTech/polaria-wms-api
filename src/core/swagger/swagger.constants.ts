/** Etiquetas Swagger agrupadas por dominio y rol. */
export const SWAGGER_TAGS = {
  AUTH: 'Autenticación',
  USUARIOS_CONFIGURADOR: 'Usuarios · Configurador',
  USUARIOS_ADMIN_CUENTA: 'Usuarios · Admin cuenta',
  CONFIGURACION_BODEGAS: 'Configuración · Bodegas',
  INTEGRACION: 'Integración · Solicitudes',
  COMPRAS_SOL: 'Compras · Solicitudes (SOL)',
  COMPRAS_OC: 'Compras · Órdenes (OC)',
  COMPRAS_RECEPCION: 'Compras · Recepción (ingreso)',
  INVENTARIO: 'Inventario · Mapa (warehouse_state)',
  OPERACIONES_ORDENES: 'Operaciones · Órdenes de trabajo',
  OPERACIONES_TAREAS: 'Operaciones · Tareas en cola',
  OPERACIONES_ALERTAS: 'Operaciones · Alertas',
  OPERACIONES_LLAMADAS: 'Operaciones · Llamadas al jefe',
  PROCESAMIENTO: 'Procesamiento · Solicitudes',
  SISTEMA: 'Sistema',
} as const;

export type SwaggerTag = (typeof SWAGGER_TAGS)[keyof typeof SWAGGER_TAGS];

export const SWAGGER_TAG_ORDER: readonly SwaggerTag[] = [
  SWAGGER_TAGS.AUTH,
  SWAGGER_TAGS.USUARIOS_CONFIGURADOR,
  SWAGGER_TAGS.USUARIOS_ADMIN_CUENTA,
  SWAGGER_TAGS.CONFIGURACION_BODEGAS,
  SWAGGER_TAGS.INTEGRACION,
  SWAGGER_TAGS.COMPRAS_SOL,
  SWAGGER_TAGS.COMPRAS_OC,
  SWAGGER_TAGS.COMPRAS_RECEPCION,
  SWAGGER_TAGS.INVENTARIO,
  SWAGGER_TAGS.OPERACIONES_ORDENES,
  SWAGGER_TAGS.OPERACIONES_TAREAS,
  SWAGGER_TAGS.OPERACIONES_ALERTAS,
  SWAGGER_TAGS.OPERACIONES_LLAMADAS,
  SWAGGER_TAGS.PROCESAMIENTO,
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
    'Alta de bodegas internas/externas y bootstrap de layout (tipos, zonas, slots). Roles: configurador o administrador_cuenta.',
  [SWAGGER_TAGS.INTEGRACION]:
    'Solicitudes de integración de bodegas externas: operador_cuenta crea; configurador consulta bandeja.',
  [SWAGGER_TAGS.COMPRAS_SOL]:
    'Solicitudes de compra (SOL): borrador, aprobación y ciclo de estados por tenant.',
  [SWAGGER_TAGS.COMPRAS_OC]:
    'Órdenes de compra (OC): creación, emisión, cancelación y conversión desde SOL.',
  [SWAGGER_TAGS.COMPRAS_RECEPCION]:
    'Recepción de mercancía contra OC: conciliación ciega, temperatura e ingreso a slot (POL-5).',
  [SWAGGER_TAGS.INVENTARIO]:
    'Mapa de bodega: lectura warehouse_state y locking en tiempo real (POL-6).',
  [SWAGGER_TAGS.OPERACIONES_ORDENES]:
    'Órdenes de trabajo de bodega: a bodega (entrada), a salida (despacho) y revisar (conteo). Jefe crea; operario ejecuta.',
  [SWAGGER_TAGS.OPERACIONES_TAREAS]:
    'Cola de tareas operativas para operario/custodio: asignación y cierre.',
  [SWAGGER_TAGS.OPERACIONES_ALERTAS]:
    'Alertas de temperatura, demora y órdenes reportadas. Jefe asigna; operario gestiona.',
  [SWAGGER_TAGS.OPERACIONES_LLAMADAS]:
    'Llamadas al jefe de bodega desde operario o procesador (flujo frio).',
  [SWAGGER_TAGS.PROCESAMIENTO]:
    'Solicitudes de procesamiento primario→secundario con merma y cierre por procesador.',
  [SWAGGER_TAGS.SISTEMA]: 'Health check y utilidades de la API.',
};
