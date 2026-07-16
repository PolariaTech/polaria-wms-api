/** Etiquetas Swagger agrupadas por dominio y rol. */
export const SWAGGER_TAGS = {
  AUTH: 'Autenticación',
  USUARIOS_CONFIGURADOR: 'Usuarios · Configurador',
  USUARIOS_ADMIN_CUENTA: 'Usuarios · Admin cuenta',
  CONFIGURACION_BODEGAS: 'Configuración · Bodegas',
  CONFIGURACION_EMPRESAS: 'Configuración · Empresas',
  CONFIGURACION_CUENTAS: 'Configuración · Cuentas',
  INTEGRACION: 'Integración · Solicitudes',
  COMPRAS_SOL: 'Compras · Solicitudes (SOL)',
  COMPRAS_OC: 'Compras · Órdenes (OC)',
  COMPRAS_RECEPCION: 'Compras · Recepción (ingreso)',
  INVENTARIO: 'Inventario · Mapa (warehouse_state)',
  OPERACIONES_ORDENES: 'Operaciones · Órdenes de trabajo',
  OPERACIONES_TAREAS: 'Operaciones · Tareas en cola',
  OPERACIONES_ALERTAS: 'Operaciones · Alertas',
  OPERACIONES_LLAMADAS: 'Operaciones · Llamadas al jefe',
  OPERACIONES_REPORTES: 'Operaciones · Reportes bodega',
  OPERACIONES_OPERARIOS: 'Operaciones · Operarios y presencia',
  VENTAS_OV: 'Ventas · Órdenes (OV)',
  TRANSPORTE: 'Transporte · Paquetes y viajes',
  PROCESAMIENTO: 'Procesamiento · Solicitudes',
  SISTEMA: 'Sistema',
} as const;

export type SwaggerTag = (typeof SWAGGER_TAGS)[keyof typeof SWAGGER_TAGS];

export const SWAGGER_TAG_ORDER: readonly SwaggerTag[] = [
  SWAGGER_TAGS.AUTH,
  SWAGGER_TAGS.USUARIOS_CONFIGURADOR,
  SWAGGER_TAGS.USUARIOS_ADMIN_CUENTA,
  SWAGGER_TAGS.CONFIGURACION_BODEGAS,
  SWAGGER_TAGS.CONFIGURACION_EMPRESAS,
  SWAGGER_TAGS.CONFIGURACION_CUENTAS,
  SWAGGER_TAGS.INTEGRACION,
  SWAGGER_TAGS.COMPRAS_SOL,
  SWAGGER_TAGS.COMPRAS_OC,
  SWAGGER_TAGS.COMPRAS_RECEPCION,
  SWAGGER_TAGS.INVENTARIO,
  SWAGGER_TAGS.OPERACIONES_ORDENES,
  SWAGGER_TAGS.OPERACIONES_TAREAS,
  SWAGGER_TAGS.OPERACIONES_ALERTAS,
  SWAGGER_TAGS.OPERACIONES_LLAMADAS,
  SWAGGER_TAGS.OPERACIONES_REPORTES,
  SWAGGER_TAGS.OPERACIONES_OPERARIOS,
  SWAGGER_TAGS.VENTAS_OV,
  SWAGGER_TAGS.TRANSPORTE,
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
  [SWAGGER_TAGS.CONFIGURACION_EMPRESAS]:
    'Actualización de empresas (razón social, teléfono y estado). Rol requerido: configurador (scope plataforma).',
  [SWAGGER_TAGS.CONFIGURACION_CUENTAS]:
    'Actualización de cuentas comerciales (nombre, credenciales/acceso y asignación de bodegas). Rol: configurador.',
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
  [SWAGGER_TAGS.OPERACIONES_REPORTES]:
    'Reportes operativos de bodega (solo lectura): admin bodega y jefe.',
  [SWAGGER_TAGS.OPERACIONES_OPERARIOS]:
    'Operarios de bodega: listado con carga y presencia (heartbeat) para asignación de tareas.',
  [SWAGGER_TAGS.VENTAS_OV]:
    'Órdenes de venta: emisión operativa con reserva de stock y tareas de despacho.',
  [SWAGGER_TAGS.TRANSPORTE]:
    'Paquete de despacho del custodio: viaje + guías + camión para el rol transportista.',
  [SWAGGER_TAGS.PROCESAMIENTO]:
    'Solicitudes de procesamiento primario→secundario con merma y cierre por procesador.',
  [SWAGGER_TAGS.SISTEMA]: 'Health check y utilidades de la API.',
};
