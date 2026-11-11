import type { Logger } from '@nestjs/common';
import { reconciliarDiferencias } from '../ai/openai-reconciliacion.client';
import type { OrigenCorreoRenglon } from '../ai/utils/origen-correo-ordenes-trabajo';
import { MAX_DIFERENCIAS_RECONCILIACION } from '../ai/utils/relectura-diferencias';
import { reconciliarRelectura } from './relectura-reconciliacion';
import type { AdvertenciaLectura } from './pedido-ia.service';

jest.mock('../ai/openai-reconciliacion.client', () => ({
  reconciliarDiferencias: jest.fn(),
}));
const reconciliarMock = reconciliarDiferencias as jest.Mock;

const logger = { warn: jest.fn() } as unknown as Logger;
const fila = (producto: string, cantidad = 1): OrigenCorreoRenglon => ({
  'Numero pedido': '133010',
  Almacen: 'COME Comedor',
  Producto: producto,
  Cantidad: cantidad,
});
const documentos = [{ nombre: 'OC 133010 COMEDOR.pdf', oc: '133010' }];

function entrada(parcial: Partial<Parameters<typeof reconciliarRelectura>[0]> = {}) {
  const advertencias: AdvertenciaLectura[] = [];
  return {
    advertencias,
    entrada: {
      instruccion: 'Solo corrige los nombres',
      antes: [fila('FRXXA FRESCA', 3)],
      leidos: [fila('FRESA FRESCA', 3)],
      archivosIgnorados: [],
      documentos,
      advertencias,
      ...parcial,
    },
  };
}

describe('reconciliarRelectura (POL-414)', () => {
  beforeEach(() => reconciliarMock.mockReset());

  it('sin instrucción, o sin diferencias, adopta lo leído y no llama a la IA', async () => {
    const sinTexto = entrada({ instruccion: '   ' });
    expect((await reconciliarRelectura(sinTexto.entrada, logger)).renglones).toBe(
      sinTexto.entrada.leidos,
    );

    const iguales = entrada({ leidos: [fila('FRXXA FRESCA', 3)] });
    expect((await reconciliarRelectura(iguales.entrada, logger)).motivos).toEqual([]);
    expect(reconciliarMock).not.toHaveBeenCalled();
  });

  it('con más diferencias que el tope no pide decidir una por una y avisa', async () => {
    const muchas = Array.from({ length: MAX_DIFERENCIAS_RECONCILIACION + 1 }, (_, i) =>
      fila(`PRODUCTO ${i}`),
    );
    const { entrada: e, advertencias } = entrada({ antes: [], leidos: muchas });

    const r = await reconciliarRelectura(e, logger);

    expect(r.renglones).toBe(muchas);
    expect(reconciliarMock).not.toHaveBeenCalled();
    expect(advertencias.map((a) => a.codigo)).toEqual(['RECONCILIACION_NO_DISPONIBLE']);
  });

  it('si la IA falla, adopta lo leído, avisa y lo registra', async () => {
    reconciliarMock.mockRejectedValue(new Error('429'));
    const { entrada: e, advertencias } = entrada();

    const r = await reconciliarRelectura(e, logger);

    expect(r.renglones).toBe(e.leidos);
    expect(advertencias.map((a) => a.codigo)).toEqual(['RECONCILIACION_NO_DISPONIBLE']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('una instrucción que no limita nada adopta lo leído, sin motivos ni alcance', async () => {
    reconciliarMock.mockResolvedValue({
      acotada: false,
      alcance: 'ignorado',
      decisiones: [{ id: 1, decision: 'descartar', motivo: '' }],
      uso: { tokensTotal: 40, costoUSD: 0.002 },
    });
    const { entrada: e, advertencias } = entrada();

    const r = await reconciliarRelectura(e, logger);

    expect(r.renglones).toBe(e.leidos);
    expect(r.motivos).toEqual([]);
    expect(r.tokensTotal).toBe(40);
    expect(advertencias).toEqual([]);
  });

  it('«Solo X» con X un archivo se resuelve en código, sin IA y siempre igual', async () => {
    const dentro = fila('FRXXA FRESCA', 3);
    const otro = { ...fila('PEPINO', 2), 'Numero pedido': '999' };
    const docs = [
      { nombre: 'OC 133010 COMEDOR.pdf', oc: '133010' },
      { nombre: 'OC 133011 BANQUETES.pdf', oc: '133011' },
    ];
    const resultados: {
      r: Awaited<ReturnType<typeof reconciliarRelectura>>;
      advertencias: AdvertenciaLectura[];
    }[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { entrada: e, advertencias } = entrada({
        instruccion: 'Solo COMEDOR',
        antes: [dentro, otro],
        leidos: [fila('FRESA FRESCA', 3)],
        documentos: docs,
      });
      resultados.push({ r: await reconciliarRelectura(e, logger), advertencias });
    }

    expect(reconciliarMock).not.toHaveBeenCalled();
    for (const { r, advertencias } of resultados) {
      expect(r.renglones.map((f) => f.Producto).sort()).toEqual(['FRESA FRESCA', 'PEPINO']);
      // El cambio de nombre del archivo se aplica; lo de otro archivo se conserva y se explica.
      expect(r.motivos).toEqual([
        expect.objectContaining({ tipo: 'quitar', aplicada: false }),
      ]);
      expect(advertencias.map((a) => a.codigo)).toEqual(['ALCANCE_INTERPRETADO']);
      expect(advertencias[0]!.detalle).toContain('OC 133010 COMEDOR.pdf');
    }
  });

  it('una instrucción acotada aplica lo decidido, explica lo demás y muestra el alcance', async () => {
    reconciliarMock.mockResolvedValue({
      acotada: true,
      alcance: '«COMEDOR» se tomó como el archivo OC 133010 COMEDOR.pdf.',
      decisiones: [{ id: 1, decision: 'descartar', motivo: 'Fuera de lo pedido.' }],
      uso: null,
    });
    const { entrada: e, advertencias } = entrada();

    const r = await reconciliarRelectura(e, logger);

    expect(r.renglones.map((f) => f.Producto)).toEqual(['FRXXA FRESCA']);
    expect(r.motivos).toEqual([
      expect.objectContaining({ tipo: 'cambiar', aplicada: false, motivo: 'Fuera de lo pedido.' }),
    ]);
    expect(advertencias).toEqual([
      { codigo: 'ALCANCE_INTERPRETADO', detalle: '«COMEDOR» se tomó como el archivo OC 133010 COMEDOR.pdf.' },
    ]);
  });
});
