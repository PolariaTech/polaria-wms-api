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

import OpenAI from 'openai';
import {
  ExtraccionTruncadaError,
  extraerPedido,
  interpretarInstruccionChat,
  type ContextoInterpretacionChat,
} from './openai-pedido.client';

const contexto: ContextoInterpretacionChat = {
  instruccion: 'Reorganiza en 21 OT',
  otActuales: 11,
  renglonesActuales: 134,
  importeActual: 27000,
  pedidosDistintos: 1,
  tieneArchivosOriginales: true,
};

function respuestaJson(contenido: unknown) {
  return {
    choices: [
      { finish_reason: 'stop', message: { content: JSON.stringify(contenido) } },
    ],
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 50,
      total_tokens: 1050,
      prompt_tokens_details: { cached_tokens: 0 },
    },
  };
}

function interpretacion(parcial: Record<string, unknown> = {}) {
  return respuestaJson({
    intencion: 'reorganizar',
    motivo: '',
    totalOt: null,
    importeTotal: null,
    ...parcial,
  });
}

describe('openai-pedido.client (REQ-187)', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'clave-de-prueba';
    process.env.OPENAI_MODEL = 'modelo-de-prueba';
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  describe('extraerPedido — respuesta cortada por el tope de salida', () => {
    it('lanza ExtraccionTruncadaError con los tokens de salida cuando finish_reason es "length"', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ finish_reason: 'length', message: { content: '{"lin' } }],
        usage: { completion_tokens: 16384 },
      });

      const lectura = extraerPedido({
        texto: 'pedido',
        archivosExtraidos: [],
        hoyISO: '2026-10-29',
        catalogoClaves: [],
        presentaciones: [],
      });

      await expect(lectura).rejects.toBeInstanceOf(ExtraccionTruncadaError);
      await expect(lectura).rejects.toMatchObject({ tokensSalida: 16384 });
    });
  });

  describe('interpretarInstruccionChat', () => {
    it('falla con un mensaje claro si falta OPENAI_API_KEY', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(interpretarInstruccionChat(contexto)).rejects.toThrow(
        'Falta OPENAI_API_KEY',
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('devuelve la intención, los totales esperados y el uso de tokens', async () => {
      mockCreate.mockResolvedValue(
        interpretacion({
          intencion: 'releer_documentos',
          motivo: 'Habla del total del documento',
          totalOt: 21,
          importeTotal: 27905.254,
        }),
      );

      const resultado = await interpretarInstruccionChat(contexto);

      expect(resultado.intencion).toBe('releer_documentos');
      expect(resultado.totalOt).toBe(21);
      expect(resultado.importeTotal).toBe(27905.25);
      expect(resultado.motivo).toBe('Habla del total del documento');
      expect(resultado.uso).toMatchObject({
        tokensEntrada: 1000,
        tokensSalida: 50,
        tokensTotal: 1050,
      });
    });

    it('pide json_schema y manda la instrucción como dato del usuario', async () => {
      mockCreate.mockResolvedValue(interpretacion());

      await interpretarInstruccionChat(contexto);

      const [peticion] = mockCreate.mock.calls[0] as [
        {
          response_format: { type: string };
          messages: { role: string; content: string }[];
        },
      ];
      expect(peticion.response_format.type).toBe('json_schema');
      const usuario = peticion.messages.find((mensaje) => mensaje.role === 'user');
      expect(JSON.parse(usuario!.content)).toMatchObject({
        instruccion: 'Reorganiza en 21 OT',
        estado: { otActuales: 11, tieneArchivosOriginales: true },
      });
    });

    it('fuerza "reorganizar" si el modelo pide releer pero la OV no tiene archivos originales', async () => {
      mockCreate.mockResolvedValue(
        interpretacion({ intencion: 'releer_documentos' }),
      );

      const resultado = await interpretarInstruccionChat({
        ...contexto,
        tieneArchivosOriginales: false,
      });

      expect(resultado.intencion).toBe('reorganizar');
    });

    it.each([
      [0, null],
      [501, null],
      [2.5, null],
      [-3, null],
      ['21', null],
      [500, 500],
      [1, 1],
    ])('totalOt %p queda como %p', async (valor, esperado) => {
      mockCreate.mockResolvedValue(interpretacion({ totalOt: valor }));

      const resultado = await interpretarInstruccionChat(contexto);

      expect(resultado.totalOt).toBe(esperado);
    });

    it.each([
      [0, null],
      [-10, null],
      ['100', null],
      [29664.35, 29664.35],
    ])('importeTotal %p queda como %p', async (valor, esperado) => {
      mockCreate.mockResolvedValue(interpretacion({ importeTotal: valor }));

      const resultado = await interpretarInstruccionChat(contexto);

      expect(resultado.importeTotal).toBe(esperado);
    });

    it('sanea el motivo: sin <>, sin caracteres de control y de máximo 120 caracteres', async () => {
      const motivo = `<script>alerta</script>\u0000‮${'a'.repeat(200)}`;
      mockCreate.mockResolvedValue(interpretacion({ motivo }));

      const resultado = await interpretarInstruccionChat(contexto);

      expect(resultado.motivo).not.toMatch(/[<>]/);
      expect(resultado.motivo).not.toMatch(/[\u0000‮]/);
      expect(Array.from(resultado.motivo).length).toBeLessThanOrEqual(120);
      expect(resultado.motivo.startsWith('scriptalerta/script')).toBe(true);
    });

    it('reintenta sin temperatura si el modelo no la admite, y lo recuerda', async () => {
      process.env.OPENAI_MODEL = 'modelo-sin-temperatura';
      const ApiError = (
        OpenAI as unknown as {
          APIError: new (mensaje: string, param: string | null) => Error;
        }
      ).APIError;
      mockCreate
        .mockRejectedValueOnce(new ApiError('temperature no soportada', 'temperature'))
        .mockResolvedValueOnce(interpretacion())
        .mockResolvedValueOnce(interpretacion());

      await interpretarInstruccionChat(contexto);
      await interpretarInstruccionChat(contexto);

      const [primera, segunda, tercera] = mockCreate.mock.calls.map(
        ([peticion]) => peticion as { temperature?: number },
      );
      expect(primera.temperature).toBe(0);
      expect(segunda.temperature).toBeUndefined();
      // La segunda interpretación ya no vuelve a intentar con temperatura.
      expect(tercera.temperature).toBeUndefined();
    });

    it('propaga cualquier otro error del proveedor para que el servicio use el respaldo por reglas', async () => {
      mockCreate.mockRejectedValue(new Error('429 demasiadas solicitudes'));

      await expect(interpretarInstruccionChat(contexto)).rejects.toThrow('429');
    });

    it('falla si OpenAI no devuelve contenido', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });

      await expect(interpretarInstruccionChat(contexto)).rejects.toThrow(
        'no devolvió contenido',
      );
    });
  });
});
