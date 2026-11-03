import { capturaPayloadTieneDespacho } from '../../services/validar-captura-despacho.service';
import {
  esClienteOcMensualAdjunta,
  filtrarDocumentosOcMensual,
  pareceOcMensualAdjunto,
  parseFechaNumerica,
} from './clasificar-adjunto-oc-mensual';

describe('clasificar-adjunto-oc-mensual (REQ-244)', () => {
  it('detecta SEADUST y KRYSTAL', () => {
    expect(esClienteOcMensualAdjunta('Hotel SEADUST Cancún')).toBe(true);
    expect(esClienteOcMensualAdjunta('KRYSTAL Grand Punta Cancun')).toBe(true);
    expect(esClienteOcMensualAdjunta('Cristal Grand')).toBe(true);
    expect(esClienteOcMensualAdjunta('Fairmont Mayakoba')).toBe(false);
  });

  it('detecta OC mensual por nombre o contenido', () => {
    expect(pareceOcMensualAdjunto('OC_MENSUAL_SEADUST_NOV.pdf')).toBe(true);
    expect(pareceOcMensualAdjunto('pedido monthly octubre.xlsx')).toBe(true);
    expect(
      pareceOcMensualAdjunto(
        'PO-9988.pdf',
        'Orden de compra mensual vigencia del mes de octubre…',
      ),
    ).toBe(true);
    expect(pareceOcMensualAdjunto('Pedido_dia_28.xlsx')).toBe(false);
  });

  it('ignora mensuales si hay Excel del día (SEADUST)', () => {
    const r = filtrarDocumentosOcMensual({
      pistasCliente: ['SEADUST Cancun'],
      tieneContextoPedido: false,
      documentos: [
        { nombre: 'pedido_28_oct.xlsx', contenido: 'jitomate 5' },
        { nombre: 'OC_mensual_octubre.pdf', contenido: 'orden de compra mensual' },
      ],
    });
    expect(r.aLeer.map((d) => d.nombre)).toEqual(['pedido_28_oct.xlsx']);
    expect(r.ignorados.map((d) => d.nombre)).toEqual(['OC_mensual_octubre.pdf']);
  });

  it('ignora mensuales si el pedido va en el cuerpo (KRYSTAL)', () => {
    const r = filtrarDocumentosOcMensual({
      pistasCliente: ['Buenos días, Krystal Grand'],
      tieneContextoPedido: true,
      documentos: [
        { nombre: 'OC mensual noviembre.pdf', contenido: 'mensual' },
      ],
    });
    expect(r.aLeer).toHaveLength(0);
    expect(r.ignorados).toHaveLength(1);
  });

  it('no filtra si lo único adjunto es la OC mensual', () => {
    const r = filtrarDocumentosOcMensual({
      pistasCliente: ['SEADUST'],
      tieneContextoPedido: false,
      documentos: [{ nombre: 'OC_mensual.pdf', contenido: 'mensual' }],
    });
    expect(r.aLeer).toHaveLength(1);
    expect(r.ignorados).toHaveLength(0);
  });

  it('no aplica a otros clientes', () => {
    const r = filtrarDocumentosOcMensual({
      pistasCliente: ['Xcaret'],
      tieneContextoPedido: true,
      documentos: [
        { nombre: 'pedido.xlsx' },
        { nombre: 'OC_mensual.pdf' },
      ],
    });
    expect(r.aLeer).toHaveLength(2);
    expect(r.ignorados).toHaveLength(0);
  });
});

describe('parseFechaNumerica (REQ-200)', () => {
  it('Accor 11/02/2026 con hoy en oct → noviembre, no febrero', () => {
    expect(parseFechaNumerica('11/02/2026', '2026-10-29')).toBe('2026-11-02');
    expect(parseFechaNumerica('21/10/2026', '2026-10-16')).toBe('2026-10-21');
  });
});

describe('capturaPayloadTieneDespacho (REQ-243)', () => {
  it('detecta nombre u hora de Despachó', () => {
    expect(
      capturaPayloadTieneDespacho({ campos: { despachoNombre: 'Juan Pérez' } }),
    ).toBe(true);
    expect(
      capturaPayloadTieneDespacho({ campos: { 'Despachó hora': '14:30' } }),
    ).toBe(true);
    expect(
      capturaPayloadTieneDespacho({ campos: { alistoNombre: 'Pedro' } }),
    ).toBe(false);
    expect(capturaPayloadTieneDespacho(null)).toBe(false);
  });
});
