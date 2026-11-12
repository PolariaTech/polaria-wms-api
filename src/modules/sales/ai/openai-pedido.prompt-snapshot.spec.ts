const mockCreate = jest.fn();

jest.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create: mockCreate } };
  }
  return { __esModule: true, default: OpenAI };
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  extraerPedido,
  interpretarInstruccionChat,
} from './openai-pedido.client';

const CAMPOS_NULOS = [
  'fechaEntregaTexto', 'centroConsumo', 'observaciones', 'ordenCompraHotel',
  'nombreCliente', 'rfc', 'regimen', 'direccion', 'anden', 'contacto',
  'telefono', 'horarioDesde', 'horarioHasta', 'tolerancia', 'sustituciones',
  'lote', 'temperatura', 'advertencia',
] as const;

const LINEA = {
  textoOriginal: 'Tomate saladet bola por kilo',
  productoCatalogo: 'TOMATE SALADET BOLA (115001100)',
  cantidad: 10,
  unidad: 'KGM' as const,
  cajas: null,
  presentacion: null,
  especificacion: 'Limpio',
  numeroPedido: 'OC-EJEMPLO-001',
  almacen: 'Cocina',
  numeroAlmacen: null,
  referenciaPedido: null,
  codigoProductoCliente: '115001100',
  responsableExterno: 'Ana Compradora',
  precioUnitario: 25.5,
};

const CATALOGO = ['TOMATE SALADET BOLA (115001100)'];
const PRESENTACIONES = ['Caja 20 kg'];
const HOY = '2026-11-11';
const SNAP_DIR = path.join(__dirname, '__snapshots__', 'openai-pedido.prompt');

const PDF_TEXTO = [
  'COTIZACIÓN / PEDIDO',
  'Cliente: Hotel Ejemplo Cancún',
  'Dirección: Calle Falsa 123, Cancún',
  'Entrega: 15 de noviembre de 2026',
  'Hora de entrega 8:00 am',
  'PO NUMBER: OC-EJEMPLO-001',
  'Producto Cantidad Precio',
  'Tomate saladet bola por kilo 10 25.50',
].join('\n');

const CORREO_CON_OC = [
  'De: <compras@ejemplo.com>',
  'Para: <ventas@ejemplo.com>',
  'Asunto: Orden de compra CUNQR0000001',
  '',
  'PO NUMBER : CUNQR0000001 Status: Fax/email/csv accepted',
  'Hotel Ejemplo Cancún',
  'Delivery date: 11/20/2026',
  'Email: compras@ejemplo.com',
  'Item: Tomate saladet bola por kilo 10 kg',
].join('\n');

function respuestaPedido() {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            ...Object.fromEntries(CAMPOS_NULOS.map((clave) => [clave, null])),
            fechaEntregaTexto: '15 de noviembre de 2026',
            nombreCliente: 'Hotel Ejemplo Cancún',
            ordenCompraHotel: 'OC-EJEMPLO-001',
            direccion: 'Calle Falsa 123, Cancún',
            contacto: 'Ana Compradora',
            horarioDesde: '08:00',
            lineas: [LINEA],
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 40,
      total_tokens: 140,
      prompt_tokens_details: { cached_tokens: 0 },
    },
  };
}

function peticionEnviada() {
  const [peticion] = mockCreate.mock.calls[0] as [
    {
      messages: Array<{ role: string; content: unknown }>;
      response_format: unknown;
      model: string;
      temperature?: number;
    },
  ];
  return peticion;
}

function compararSnap(nombre: string, valor: string) {
  const archivo = path.join(SNAP_DIR, nombre);
  if (process.env.UPDATE_PROMPT_SNAPSHOT === '1') {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(archivo, valor);
  }
  expect(fs.readFileSync(archivo, 'utf8')).toBe(valor);
}

function textoUsuario(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((parte: { type?: string; text?: string }) =>
      parte.type === 'text' ? parte.text ?? '' : JSON.stringify(parte),
    )
    .join('\n');
}

describe('openai-pedido prompt snapshot (fase 0)', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'clave-de-prueba';
    process.env.OPENAI_MODEL = 'modelo-snapshot-fase0';
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  it('PDF de texto: petición y PedidoExtraido', async () => {
    mockCreate.mockResolvedValue(respuestaPedido());

    const { pedido } = await extraerPedido({
      texto: '',
      archivosExtraidos: [
        { tipo: 'texto', nombre: 'Pedido.pdf', contenido: PDF_TEXTO },
      ],
      hoyISO: HOY,
      catalogoClaves: CATALOGO,
      presentaciones: PRESENTACIONES,
    });

    const peticion = peticionEnviada();
    const sistema = peticion.messages.find((m) => m.role === 'system');
    const usuario = peticion.messages.find((m) => m.role === 'user');
    compararSnap('extraer.system.txt', String(sistema?.content ?? ''));
    compararSnap('pdf.user.txt', textoUsuario(usuario?.content));
    compararSnap(
      'extraer.meta.json',
      `${JSON.stringify({ model: peticion.model, temperature: peticion.temperature }, null, 2)}\n`,
    );
    compararSnap(
      'extraer.response-format.json',
      `${JSON.stringify(peticion.response_format)}\n`,
    );
    compararSnap('pdf.pedido.json', `${JSON.stringify(pedido, null, 2)}\n`);
  });

  it('correo con OC: petición y PedidoExtraido', async () => {
    mockCreate.mockResolvedValue(respuestaPedido());

    const { pedido } = await extraerPedido({
      texto: CORREO_CON_OC,
      archivosExtraidos: [],
      hoyISO: HOY,
      catalogoClaves: CATALOGO,
      presentaciones: PRESENTACIONES,
    });

    const peticion = peticionEnviada();
    const sistema = peticion.messages.find((m) => m.role === 'system');
    const usuario = peticion.messages.find((m) => m.role === 'user');
    compararSnap('extraer.system.txt', String(sistema?.content ?? ''));
    compararSnap('correo.user.txt', textoUsuario(usuario?.content));
    compararSnap(
      'extraer.meta.json',
      `${JSON.stringify({ model: peticion.model, temperature: peticion.temperature }, null, 2)}\n`,
    );
    compararSnap(
      'extraer.response-format.json',
      `${JSON.stringify(peticion.response_format)}\n`,
    );
    compararSnap('correo.pedido.json', `${JSON.stringify(pedido, null, 2)}\n`);
  });

  it('interpretarInstruccionChat: petición y resultado', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              intencion: 'reorganizar',
              motivo: 'El usuario pide reorganizar las OT existentes.',
              totalOt: 3,
              importeTotal: null,
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 80,
        completion_tokens: 20,
        total_tokens: 100,
        prompt_tokens_details: { cached_tokens: 0 },
      },
    });

    const resultado = await interpretarInstruccionChat({
      instruccion: 'Reorganiza en 3 OT el pedido del Hotel Ejemplo',
      otActuales: 2,
      renglonesActuales: 8,
      importeActual: 1500,
      pedidosDistintos: 1,
      tieneArchivosOriginales: true,
    });

    const peticion = peticionEnviada();
    const sistema = peticion.messages.find((m) => m.role === 'system');
    const usuario = peticion.messages.find((m) => m.role === 'user');
    compararSnap('chat.system.txt', String(sistema?.content ?? ''));
    compararSnap('chat.user.txt', textoUsuario(usuario?.content));
    compararSnap(
      'chat.meta.json',
      `${JSON.stringify({ model: peticion.model, temperature: peticion.temperature }, null, 2)}\n`,
    );
    compararSnap(
      'chat.response-format.json',
      `${JSON.stringify(peticion.response_format, null, 2)}\n`,
    );
    compararSnap('chat.resultado.json', `${JSON.stringify(resultado, null, 2)}\n`);
  });
});
