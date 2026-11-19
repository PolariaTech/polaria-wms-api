import type { EmpresaFichaFiscal } from '../interfaces/empresa.interfaces';

const CAMPOS_FICHA = [
  'rfc',
  'regimenFiscal',
  'codigoPostalExpedicion',
  'nombreCuentaBancaria',
  'banco',
  'clabe',
  'correoCobranza',
  'serieFactura',
] as const satisfies readonly (keyof EmpresaFichaFiscal)[];

/** Copia solo los campos fiscales que vinieron en el cuerpo. */
export function fichaFiscalPresente(
  dto: Partial<EmpresaFichaFiscal>,
): Partial<EmpresaFichaFiscal> {
  const presente: Partial<EmpresaFichaFiscal> = {};

  for (const campo of CAMPOS_FICHA) {
    if (dto[campo] !== undefined) {
      presente[campo] = dto[campo] ?? null;
    }
  }

  return presente;
}
