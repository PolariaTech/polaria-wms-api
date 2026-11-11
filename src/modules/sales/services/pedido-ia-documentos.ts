/**
 * Separación de lo que el extractor devolvió en contexto, documentos y no legibles, y
 * lectura de documentos con concurrencia acotada. Funciones puras, sin acceso a base de
 * datos ni a OpenAI. (POL-414: `excluirDocumentosIgnorados`.)
 */
import {
  type ArchivoExtraido,
  type ArchivoImagen,
  type ArchivoNoLegible,
  type ArchivoTexto,
} from '../ai/file-extractors';
import { descartarDocumentosRepetidos } from '../ai/utils/dedupe-documentos';

const RE_CUERPO_CORREO = /—\s*cuerpo$/i;
const SEPARADOR_ADJUNTO_EML = ' → ';

export interface DocumentoParaLeer {
  nombre: string;
  archivos: ArchivoExtraido[];
  /** Solo los documentos de texto (PDF/Excel/Word) se pueden releer por bloques. */
  esTexto: boolean;
}

/** `correo.eml → AGUACATES_4502987081.pdf` → `aguacates_4502987081.pdf`. */
export function nombreBaseAdjunto(nombre: string): string {
  const posicionSeparador = nombre.lastIndexOf(SEPARADOR_ADJUNTO_EML);
  return (
    posicionSeparador >= 0
      ? nombre.slice(posicionSeparador + SEPARADOR_ADJUNTO_EML.length)
      : nombre
  )
    .trim()
    .toLowerCase();
}

/**
 * Separa lo que el extractor devolvió en: contexto (cuerpos de correo), documentos (cada
 * PDF/Excel/Word es uno) y no legibles. Un adjunto incrustado en un .eml que además se
 * subió suelto se descarta (se leía dos veces). Las imágenes son un solo documento, o
 * van con el primero si hay documentos de texto (una foto no es un pedido aparte).
 */
export function separarContextoYDocumentos(
  extraidos: readonly ArchivoExtraido[],
): {
  contexto: ArchivoTexto[];
  documentos: DocumentoParaLeer[];
  noLegibles: ArchivoNoLegible[];
  duplicados: string[];
} {
  const contexto: ArchivoTexto[] = [];
  const textos: ArchivoTexto[] = [];
  const imagenes: ArchivoImagen[] = [];
  const noLegibles: ArchivoNoLegible[] = [];

  for (const archivo of extraidos) {
    if (archivo.tipo === 'no_legible') noLegibles.push(archivo);
    else if (archivo.tipo === 'imagen') imagenes.push(archivo);
    else if (RE_CUERPO_CORREO.test(archivo.nombre)) contexto.push(archivo);
    else textos.push(archivo);
  }

  const { unicos, duplicados } = descartarDocumentosRepetidos(textos, {
    separadorEml: SEPARADOR_ADJUNTO_EML,
    nombreBase: nombreBaseAdjunto,
  });
  const documentos: DocumentoParaLeer[] = unicos.map((texto) => ({
    nombre: texto.nombre,
    archivos: [texto],
    esTexto: true,
  }));

  if (imagenes.length > 0) {
    if (documentos.length > 0) {
      documentos[0].archivos = [...documentos[0].archivos, ...imagenes];
    } else {
      documentos.push({
        nombre: imagenes.map((imagen) => imagen.nombre).join(', '),
        archivos: imagenes,
        esTexto: false,
      });
    }
  }

  return { contexto, documentos, noLegibles, duplicados };
}

/** Ejecuta `fn` sobre cada elemento con a lo sumo `limite` en vuelo; conserva el orden. */
export async function mapConLimite<T, R>(
  items: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  const trabajadores = Array.from(
    { length: Math.min(limite, items.length) },
    async () => {
      while (siguiente < items.length) {
        const indice = siguiente;
        siguiente += 1;
        resultados[indice] = await fn(items[indice], indice);
      }
    },
  );
  await Promise.all(trabajadores);
  return resultados;
}

/**
 * POL-414: quita los documentos cuyo nombre está en `ignorar`. También descarta la copia
 * incrustada en un .eml, que de otro modo se leería al dejar de ser un duplicado.
 */
export function excluirDocumentosIgnorados(
  documentos: DocumentoParaLeer[],
  ignorar: readonly string[] | undefined,
): DocumentoParaLeer[] {
  const nombres = new Set((ignorar ?? []).map((nombre) => nombre.toLowerCase()));
  if (nombres.size === 0) return documentos;
  return documentos.filter(
    (documento) => !nombres.has(nombreBaseAdjunto(documento.nombre)),
  );
}
