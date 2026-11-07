/** Ayudantes para leer la salida cruda (JSON) que devuelve el modelo. */

export function esObjetoPlano(
  valor: unknown,
): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Verdadero si el objeto tiene exactamente esas claves, sin importar el orden. */
export function clavesExactas(
  objeto: Record<string, unknown>,
  esperadas: readonly string[],
): boolean {
  const claves = Object.keys(objeto).sort();
  const ordenadas = [...esperadas].sort();
  return (
    claves.length === ordenadas.length &&
    claves.every((clave, i) => clave === ordenadas[i])
  );
}
