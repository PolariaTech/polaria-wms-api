import * as XLSX from 'xlsx';
import { extractFromExcel } from './file-extractors';

describe('extractFromExcel con hojas ocultas (OV-1775)', () => {
  function libroDePedido(ocultas: 0 | 1 | 2): Buffer {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([['AGUACATE HASS', '50']]),
      'COCINA CENTRAL',
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([['BERRO', '1']]),
      'PESCADOR',
    );
    libro.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: ocultas }] };
    return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  it('el texto que llega a Mateo no incluye las hojas ocultas', () => {
    const contenido = extractFromExcel(libroDePedido(1));
    expect(contenido).toContain('# Hoja: COCINA CENTRAL');
    expect(contenido).toContain('AGUACATE HASS');
    expect(contenido).not.toContain('PESCADOR');
    expect(contenido).not.toContain('BERRO');
  });

  it('tampoco incluye las hojas muy ocultas', () => {
    const contenido = extractFromExcel(libroDePedido(2));
    expect(contenido).not.toContain('BERRO');
  });

  it('con todas las hojas visibles las lee todas', () => {
    const contenido = extractFromExcel(libroDePedido(0));
    expect(contenido).toContain('# Hoja: PESCADOR');
    expect(contenido).toContain('BERRO');
  });
});
