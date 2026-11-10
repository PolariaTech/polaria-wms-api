/**
 * POL-414 · Filtro por archivo de la relectura: lo que la instrucción pide ignorar no se
 * lee, y el archivo ignorado aparece en la propuesta con 0 productos para que se vea.
 */
import type { DocumentoCorreccionDto } from '../dto/propuesta-correccion-correo.dto';
import { archivosAIgnorar } from '../ai/utils/relectura-archivos-ignorados';
import type { AdvertenciaLectura } from './pedido-ia.service';

/**
 * Separa los archivos a leer de los ignorados por la instrucción y deja un aviso por cada
 * ignorado en `advertencias`.
 */
export function filtrarArchivosIgnorados<T extends { originalname: string }>(
  instruccion: string | undefined,
  archivos: readonly T[],
  advertencias: AdvertenciaLectura[],
): { aLeer: T[]; ignorados: string[] } {
  const ignorados = archivosAIgnorar(
    instruccion,
    archivos.map((archivo) => archivo.originalname),
  );
  for (const nombre of ignorados) {
    advertencias.push({
      codigo: 'ARCHIVO_IGNORADO',
      documento: nombre,
      detalle: 'No se leyó este archivo porque pediste ignorarlo.',
    });
  }
  return {
    aLeer: archivos.filter((archivo) => !ignorados.includes(archivo.originalname)),
    ignorados,
  };
}

/** Un archivo ignorado se lista con 0 productos: se ve que no se leyó. */
export function documentosIgnorados(
  nombres: readonly string[],
): DocumentoCorreccionDto[] {
  return nombres.map((nombre) => ({
    nombre,
    oc: null,
    ocFuente: null,
    renglones: 0,
    verificacion: {
      totalDocumento: null,
      importe: 0,
      diferencia: null,
      cuadra: null,
    },
    relecturaPorBloques: false,
  }));
}
