const mockCreate = jest.fn();

jest.mock('openai', () => {
  class APIError extends Error {
    constructor(
      message: string,
      readonly param: string | null,
    ) {
      super(message);
    }
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create: mockCreate } };
  }
  return { __esModule: true, default: OpenAI };
});

import { extraerPedido } from './openai-pedido.client';

function respuestaVacia() {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            fechaEntregaTexto: null,
            centroConsumo: null,
            observaciones: null,
            ordenCompraHotel: null,
            nombreCliente: null,
            rfc: null,
            regimen: null,
            direccion: null,
            anden: null,
            contacto: null,
            telefono: null,
            horarioDesde: null,
            horarioHasta: null,
            tolerancia: null,
            sustituciones: null,
            lote: null,
            temperatura: null,
            advertencia: null,
            lineas: [],
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: 20,
    },
  };
}

describe('openai-pedido prompt (REQ-299)', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'clave-de-prueba';
    process.env.OPENAI_MODEL = 'modelo-de-prueba';
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  it('el prompt de extraerPedido incluye la regla de código del cliente', async () => {
    mockCreate.mockResolvedValue(respuestaVacia());

    await extraerPedido({
      texto: 'pedido',
      archivosExtraidos: [],
      hoyISO: '2026-11-11',
      catalogoClaves: [],
      presentaciones: [],
    });

    const [peticion] = mockCreate.mock.calls[0] as [
      { messages: Array<{ role: string; content: unknown }> },
    ];
    const sistema = peticion.messages.find(
      (mensaje) => mensaje.role === 'system',
    );
    const texto = typeof sistema?.content === 'string' ? sistema.content : '';
    expect(texto).toMatch(/- Código del cliente \(REQ-299\)/);
    expect(texto).toMatch(
      /"codigoProductoCliente" es SOLO el código escrito en ESE renglón/,
    );
    expect(texto).toMatch(
      /Nunca copies ahí un SKU del catálogo ni los SKU de las reglas/,
    );
    expect(texto).toMatch(/Si el renglón no trae código → null/);
  });
});
