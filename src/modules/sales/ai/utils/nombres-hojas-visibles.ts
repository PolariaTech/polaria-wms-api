import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';

/**
 * Nombres de las hojas de un libro de Excel que el cliente ve al abrirlo.
 *
 * Los libros de pedido suelen traer hojas ocultas con pedidos viejos y plantillas de otros
 * locales; leerlas hizo que Mateo tomara productos que el cliente no pidió (OV-1775).
 * Si todas las hojas están ocultas se devuelven todas, para no entregar un libro vacío.
 */
export function nombresHojasVisibles(libro: WorkBook): string[] {
  const propiedades = libro.Workbook?.Sheets ?? [];
  const visibles = libro.SheetNames.filter(
    (_nombre, indice) => !propiedades[indice]?.Hidden,
  );
  return visibles.length > 0 ? visibles : libro.SheetNames;
}

/** Lee el libro y deja en `SheetNames` solo las hojas visibles (ver `nombresHojasVisibles`). */
export function leerLibroConHojasVisibles(buffer: Buffer): WorkBook {
  const libro = XLSX.read(buffer, { type: 'buffer' });
  libro.SheetNames = nombresHojasVisibles(libro);
  return libro;
}
