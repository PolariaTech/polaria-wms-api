const mockCreate = jest.fn();

jest.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create: mockCreate } };
  }
  return { __esModule: true, default: OpenAI };
});

import { extraerPedido } from './openai-pedido.client';

const CAMPOS_NULOS = [
  'fechaEntregaTexto', 'centroConsumo', 'observaciones', 'ordenCompraHotel', 'nombreCliente',
  'rfc', 'regimen', 'direccion', 'anden', 'contacto', 'telefono', 'horarioDesde',
  'horarioHasta', 'tolerancia', 'sustituciones', 'lote', 'temperatura', 'advertencia',
];

const LINEA = {
  textoOriginal: 'Tomate verde',
  productoCatalogo: null,
  cantidad: 3,
  unidad: 'KGM',
  cajas: null,
  presentacion: null,
  numeroPedido: null,
  almacen: null,
  numeroAlmacen: null,
  referenciaPedido: null,
  codigoProductoCliente: null,
  responsableExterno: null,
  precioUnitario: null,
};

describe('extraerPedido — especificación en origenCorreo (REQ-287)', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'clave-de-prueba';
    process.env.OPENAI_MODEL = 'modelo-de-prueba';
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  it('lleva lineas[].especificacion a Especificacion de cada renglón y omite la vacía', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              ...Object.fromEntries(CAMPOS_NULOS.map((clave) => [clave, null])),
              lineas: [
                { ...LINEA, especificacion: 'Limpio, sin cáscara' },
                { ...LINEA, textoOriginal: 'Piña', especificacion: null },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });

    const { pedido } = await extraerPedido({
      texto: 'pedido',
      archivosExtraidos: [],
      hoyISO: '2026-11-11',
      catalogoClaves: [],
      presentaciones: [],
    });

    expect(pedido.origenCorreo[0]?.Especificacion).toBe('Limpio, sin cáscara');
    expect(pedido.origenCorreo[1]).not.toHaveProperty('Especificacion');
    expect(pedido.lineas[0]?.especificacion).toBe('Limpio, sin cáscara');
  });
});
