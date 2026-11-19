import { PrismaService } from '../../../core/database/prisma.service';
import { EmpresaRepository } from './empresa.repository';

describe('EmpresaRepository', () => {
  const prisma = {
    empresa: {
      create: jest.fn(),
      update: jest.fn(),
    },
    provisionEmpresaSchema: jest.fn(),
  };
  const repository = new EmpresaRepository(prisma as unknown as PrismaService);

  const fila = {
    codigoEmpresa: 'Y9IHZ',
    razonSocial: 'Aguacates de puebla',
    telefono: null,
    estaActiva: true,
    schemaName: null,
    rfc: 'APU210325668',
    regimenFiscal: '601',
    codigoPostalExpedicion: '77560',
    nombreCuentaBancaria: 'Aguacates de Puebla',
    banco: 'BBVA',
    clabe: '012528001186364430',
    correoCobranza: 'cobranza@aguacatesdepuebla.com',
    serieFactura: 'CS-',
    logoPath: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guarda la ficha y omite logoPath si no vino archivo', async () => {
    prisma.empresa.create.mockResolvedValue(fila);
    prisma.provisionEmpresaSchema.mockResolvedValue('emp_jbr_cygnus_y9ihz');

    const creada = await repository.create({
      codigoEmpresa: 'Y9IHZ',
      razonSocial: 'Aguacates de puebla',
      rfc: 'APU210325668',
      clabe: '012528001186364430',
    });

    const data = prisma.empresa.create.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.rfc).toBe('APU210325668');
    expect(data.clabe).toBe('012528001186364430');
    expect(data).not.toHaveProperty('logoPath');
    expect(creada.schemaName).toBe('emp_jbr_cygnus_y9ihz');
  });

  it('actualiza solo los campos enviados, incluido el logo', async () => {
    prisma.empresa.update.mockResolvedValue({
      ...fila,
      logoPath: 'Y9IHZ/logo.jpg',
    });

    await repository.update('Y9IHZ', { logoPath: 'Y9IHZ/logo.jpg' });

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { codigoEmpresa: 'Y9IHZ' },
      data: { logoPath: 'Y9IHZ/logo.jpg' },
      select: expect.objectContaining({
        rfc: true,
        logoPath: true,
        clabe: true,
      }),
    });
  });
});
