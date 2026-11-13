import { InternalServerErrorException, Logger } from '@nestjs/common';
import {
  cargarHermanasRelectura,
  cargarOrden,
} from './orden-correo-relectura.consulta';
import { ID_OV, orden } from './orden-correo-relectura.fixtures';

describe('consultas de la relectura del correo (REQ-313)', () => {
  const logger = new Logger('prueba');
  let prisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  const datos = (origenArchivos: string | null) => ({
    idOrdenVenta: ID_OV,
    codigoCuenta: '1YW43',
    origenArchivos,
    requestId: 'r-1',
  });

  it('la consulta de hermanas filtra por cuenta, mismos archivos, excluye la propia OV y las canceladas', async () => {
    const origenArchivos = orden().origenArchivos;

    await cargarHermanasRelectura(
      prisma as never,
      'emp_demo',
      logger,
      datos(origenArchivos),
    );

    const [sql, ...parametros] = prisma.$queryRawUnsafe.mock
      .calls[0] as string[];
    expect(sql).toContain('FROM emp_demo.orden_venta');
    expect(sql).toMatch(/codigo_cuenta = \$1/);
    expect(sql).toMatch(/origen_archivos = \$2/);
    expect(sql).toMatch(/id_orden_venta <> \$3::uuid/);
    expect(sql).toMatch(/estado::text <> 'cancelada'/);
    expect(parametros).toEqual(['1YW43', origenArchivos, ID_OV]);
  });

  it.each([
    [null],
    ['correo.eml, pedido.pdf'],
    [JSON.stringify([{ nombre: 'a' }])],
  ])('sin adjuntos con path (%s) no consulta', async (origenArchivos) => {
    const r = await cargarHermanasRelectura(
      prisma as never,
      'emp_demo',
      logger,
      datos(origenArchivos),
    );

    expect(r).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('un fallo de la base responde sin detalles técnicos', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(
      new Error('password authentication failed'),
    );

    await expect(
      cargarHermanasRelectura(
        prisma as never,
        'emp_demo',
        logger,
        datos(orden().origenArchivos),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('cargarOrden trae también la OC de la OV', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([orden()]);

    await cargarOrden(prisma as never, 'emp_demo', logger, ID_OV, 'r-1');

    expect(String(prisma.$queryRawUnsafe.mock.calls[0]![0])).toContain(
      'orden_compra_hotel AS "ordenCompraHotel"',
    );
  });
});
