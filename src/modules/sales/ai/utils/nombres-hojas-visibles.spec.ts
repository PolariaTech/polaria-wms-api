import * as XLSX from 'xlsx';
import { nombresHojasVisibles } from './nombres-hojas-visibles';

function libroConHojas(
  hojas: Array<{ nombre: string; filas: string[][]; oculta?: 0 | 1 | 2 }>,
): XLSX.WorkBook {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet(hoja.filas),
      hoja.nombre,
    );
  }
  libro.Workbook = {
    Sheets: hojas.map((hoja) => ({ Hidden: hoja.oculta ?? 0 })),
  };
  return libro;
}

describe('nombresHojasVisibles (OV-1775)', () => {
  it('lista solo las hojas visibles', () => {
    const libro = libroConHojas([
      { nombre: 'COCINA CENTRAL', filas: [['AGUACATE HASS', '50']] },
      { nombre: 'PESCADOR', filas: [['BERRO', '1']], oculta: 1 },
      { nombre: 'PRECIOS MAESTROS', filas: [['FRESA', '240']], oculta: 2 },
    ]);
    expect(nombresHojasVisibles(libro)).toEqual(['COCINA CENTRAL']);
  });

  it('devuelve todas las hojas si ninguna es visible', () => {
    const libro = libroConHojas([
      { nombre: 'UNO', filas: [['A', '1']], oculta: 1 },
      { nombre: 'DOS', filas: [['B', '2']], oculta: 1 },
    ]);
    expect(nombresHojasVisibles(libro)).toEqual(['UNO', 'DOS']);
  });

  it('un libro sin información de visibilidad se lee completo', () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([['A']]),
      'UNO',
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([['B']]),
      'DOS',
    );
    expect(nombresHojasVisibles(libro)).toEqual(['UNO', 'DOS']);
  });
});
