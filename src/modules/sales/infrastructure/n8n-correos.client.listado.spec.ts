import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { N8nCorreosClient } from './n8n-correos.client';

const ENTRADA = { modo: 'todos' as const, pagina: 1, tamano: 25 };

const llavePrueba = randomUUID();

function cliente() {
  const valores: Record<string, string> = {
    N8N_CORREOS_URL: 'https://n8n.test/webhook',
    N8N_CORREOS_API_KEY: llavePrueba,
  };
  const config = { get: (clave: string) => valores[clave] };
  return new N8nCorreosClient(config as unknown as ConfigService);
}

function responder(cuerpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(cuerpo),
  } as unknown as Response;
}

describe('N8nCorreosClient: listado (REQ-275)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('columnas que anota el workflow', () => {
    it('expone el resultado, la confianza, el tipo y la OV en que se convirtió el correo', async () => {
      fetchMock.mockResolvedValue(
        responder({
          total: 2,
          filas: [
            {
              message_id: 'abc123def',
              nuevo_pedido: true,
              resultado: 'ingresado',
              confianza: 'alta',
              tipo: 'pedido',
              codigo_orden_venta: 'OV-00001132, OV-00001133',
            },
            {
              message_id: 'xyz987uvw',
              resultado: '  ',
              confianza: 5,
              tipo: null,
              codigo_orden_venta: '',
            },
          ],
        }),
      );

      const { filas } = await cliente().listar(ENTRADA);

      expect(filas[0]).toMatchObject({
        nuevoPedido: true,
        resultado: 'ingresado',
        confianza: 'alta',
        tipo: 'pedido',
        codigoOrdenVenta: 'OV-00001132, OV-00001133',
      });
      expect(filas[1]).toMatchObject({
        resultado: null,
        confianza: null,
        tipo: null,
        codigoOrdenVenta: null,
      });
    });
  });

  describe('caché del listado', () => {
    const listadoDeN8n = {
      total: 1,
      filas: [{ message_id: 'abc123def', resultado: 'recibido' }],
    };

    it('pide el listado una sola vez mientras el mismo filtro siga vigente', async () => {
      fetchMock.mockResolvedValue(responder(listadoDeN8n));
      const unico = cliente();

      const primero = await unico.listar(ENTRADA);
      const segundo = await unico.listar({ ...ENTRADA });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(segundo).toEqual(primero);
    });

    it('un filtro distinto va a n8n y no mezcla las respuestas', async () => {
      fetchMock.mockResolvedValue(responder(listadoDeN8n));
      const unico = cliente();

      await unico.listar(ENTRADA);
      await unico.listar({ ...ENTRADA, remitente: 'hotel' });
      await unico.listar({ ...ENTRADA, pagina: 2 });

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('vuelve a pedirlo pasados treinta segundos', async () => {
      fetchMock.mockResolvedValue(responder(listadoDeN8n));
      const unico = cliente();
      const ahora = jest.spyOn(Date, 'now');
      try {
        ahora.mockReturnValue(2_000_000);
        await unico.listar(ENTRADA);
        ahora.mockReturnValue(2_000_000 + 29_000);
        await unico.listar(ENTRADA);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        ahora.mockReturnValue(2_000_000 + 30_000 + 1);
        await unico.listar(ENTRADA);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        ahora.mockRestore();
      }
    });

    it('dos peticiones a la vez con el mismo filtro comparten una sola llamada', async () => {
      fetchMock.mockImplementation(
        () =>
          new Promise((resolver) =>
            setTimeout(() => resolver(responder(listadoDeN8n)), 10),
          ),
      );
      const unico = cliente();

      await Promise.all([unico.listar(ENTRADA), unico.listar(ENTRADA)]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('un fallo de n8n no se queda guardado', async () => {
      fetchMock
        .mockResolvedValueOnce(responder({}, false, 500))
        .mockResolvedValue(responder(listadoDeN8n));
      const unico = cliente();

      await expect(unico.listar(ENTRADA)).rejects.toMatchObject({
        response: { error: 'N8N_ERROR' },
      });
      await expect(unico.listar(ENTRADA)).resolves.toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('guarda pocos listados: al pasar de veinte se descarta el más viejo', async () => {
      fetchMock.mockResolvedValue(responder(listadoDeN8n));
      const unico = cliente();
      for (let vuelta = 1; vuelta <= 21; vuelta += 1) {
        await unico.listar({ ...ENTRADA, pagina: vuelta });
      }
      expect(fetchMock).toHaveBeenCalledTimes(21);

      await unico.listar({ ...ENTRADA, pagina: 21 }); // el último sigue guardado
      expect(fetchMock).toHaveBeenCalledTimes(21);
      await unico.listar({ ...ENTRADA, pagina: 1 }); // el primero ya no
      expect(fetchMock).toHaveBeenCalledTimes(22);
    });
  });
});
