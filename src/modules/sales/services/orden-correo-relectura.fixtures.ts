/** Datos de prueba compartidos de la relectura del correo (OV-940/943 y POL-414). */
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import fixture from '../ai/utils/__fixtures__/relectura-ov-940-943.json';
import type { PropuestaCorreccionCorreoBodyDto } from '../dto/propuesta-correccion-correo.dto';
import type { DocumentoLeido } from './pedido-ia.service';

export const ID_OV = '550e8400-e29b-41d4-a716-446655440000';
export const ID_BODEGA = '660e8400-e29b-41d4-a716-446655440001';
export const REQUEST_ID = '770e8400-e29b-41d4-a716-446655440002';

export const ctx: TenantContext = {
  idUsuario: 'user-1',
  idRol: WmsRol.operador_cuenta,
  nivelRol: RolNivel.cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: '1YW43',
  codigosCuentaEmpresa: ['1YW43'],
  idBodegas: [],
  schemaName: 'emp_demo',
};

export const body: PropuestaCorreccionCorreoBodyDto = { requestId: REQUEST_ID };

export type DocFixture = (typeof fixture.documentos)[number];
export type Fila = Record<string, string | number>;

export function renglonesDe(doc: DocFixture): Fila[] {
  const filas: Fila[] = [];
  for (const [almacen, datos] of Object.entries(doc.almacenes)) {
    for (let i = 0; i < datos.renglones; i += 1) {
      filas.push({
        Producto: `PRODUCTO ${filas.length}`,
        Almacen: almacen,
        Cantidad: 1,
        Precio: datos.importe / datos.renglones,
        'Numero pedido': doc.oc,
        'Numero correo': 'correo-1',
        Horario: '2026-10-28 09:00:00',
      });
    }
  }
  return filas;
}

export function documentoLeido(doc: DocFixture, cuadra: boolean | null = true): DocumentoLeido {
  return {
    nombre: doc.nombre,
    oc: doc.oc,
    ocFuente: 'ambas',
    renglones: doc.renglones,
    verificacion: {
      totalDocumento: doc.totalDocumento,
      importe: cuadra === false ? 1 : doc.totalDocumento,
      diferencia: cuadra === false ? 1 - doc.totalDocumento : 0,
      cuadra,
    },
    relecturaPorBloques: false,
  };
}

export const [doc940, doc081, doc208] = fixture.documentos;

/** OV-943 tal como quedó mal leída: solo el primer PDF y apenas 60 de sus renglones (6 almacenes). */
export const origenIncompleto = renglonesDe(doc081!).slice(0, 60);

export function orden(parcial: Record<string, unknown> = {}) {
  return {
    idOrdenVenta: ID_OV,
    codigoCuenta: '1YW43',
    idBodega: ID_BODEGA,
    estado: 'por_confirmar',
    origenCorreo: origenIncompleto,
    origenArchivos: JSON.stringify([
      { nombre: 'correo.eml', path: '1yw43/a-correo.eml', mime: 'message/rfc822', bytes: 10 },
      { nombre: doc081!.nombre, path: `1yw43/b-${doc081!.nombre}`, mime: 'application/pdf', bytes: 10 },
      { nombre: doc208!.nombre, path: `1yw43/c-${doc208!.nombre}`, mime: 'application/pdf', bytes: 10 },
    ]),
    ...parcial,
  };
}

/** Respuesta de `$queryRawUnsafe`: `filas` para la OV y, sin hermanas, [] para su consulta (REQ-313). */
export function respuestaOrden(filas: unknown[], hermanas: unknown[] = []) {
  return (sql: string): Promise<unknown[]> =>
    Promise.resolve(/id_orden_venta <> /.test(sql) ? hermanas : filas);
}

export function lectura943(cuadra: boolean | null = true, advertencias: unknown[] = []) {
  return {
    pedido: { origenCorreo: [...renglonesDe(doc081!), ...renglonesDe(doc208!)] },
    textoOrigen: '',
    documentos: [documentoLeido(doc081!, cuadra), documentoLeido(doc208!, cuadra)],
    advertencias,
    catalogoProductos: 197,
    tokensTotal: 1000,
    costoUSD: 0.01,
  };
}
