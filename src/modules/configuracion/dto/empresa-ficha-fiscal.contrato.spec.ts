import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { fichaFiscalPresente } from '../domain/empresa-ficha-fiscal';
import { EmpresaRepository } from '../infrastructure/empresa.repository';
import { UpdateEmpresaDto } from './update-empresa.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function validar(body: unknown) {
  return pipe.transform(body, {
    type: 'body',
    metatype: UpdateEmpresaDto,
  });
}

describe('contrato ficha fiscal entre validación y base', () => {
  const prisma = {
    empresa: {
      create: jest.fn(),
      update: jest.fn(),
    },
    provisionEmpresaSchema: jest.fn(),
  };
  const repository = new EmpresaRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.empresa.update.mockResolvedValue({ codigoEmpresa: 'Y9IHZ' });
  });

  async function aceptaYPersiste(
    body: Record<string, unknown>,
    esperado: Record<string, unknown>,
  ) {
    const dto = (await validar(body)) as UpdateEmpresaDto;
    await repository.update('Y9IHZ', fichaFiscalPresente(dto));
    expect(prisma.empresa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining(esperado),
      }),
    );
  }

  it('persiste rfc, código postal y clabe sin validar el formato', async () => {
    await aceptaYPersiste(
      {
        rfc: 'APU210325668',
        codigoPostalExpedicion: '77560',
        clabe: '012528001186364430',
      },
      {
        rfc: 'APU210325668',
        codigoPostalExpedicion: '77560',
        clabe: '012528001186364430',
      },
    );
    jest.clearAllMocks();
    prisma.empresa.update.mockResolvedValue({ codigoEmpresa: 'Y9IHZ' });
    await aceptaYPersiste(
      {
        rfc: '',
        codigoPostalExpedicion: '7756',
        clabe: '12345678901234567',
      },
      {
        rfc: null,
        codigoPostalExpedicion: '7756',
        clabe: '12345678901234567',
      },
    );
  });

  it('persiste régimen de 3 dígitos y rechaza 2 o 4 sin escribir', async () => {
    await aceptaYPersiste({ regimenFiscal: '601' }, { regimenFiscal: '601' });

    for (const regimenFiscal of ['61', '6011']) {
      jest.clearAllMocks();
      const error = await validar({ regimenFiscal }).catch(
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(BadRequestException);
      const respuesta = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(respuesta.message).toContain('El régimen fiscal no es válido.');
      expect(prisma.empresa.update).not.toHaveBeenCalled();
      expect(prisma.empresa.create).not.toHaveBeenCalled();
    }
  });

  it('persiste el correo del schema y rechaza el inválido con su mensaje', async () => {
    await aceptaYPersiste(
      { correoCobranza: 'cobranza@aguacatesdepuebla.com' },
      { correoCobranza: 'cobranza@aguacatesdepuebla.com' },
    );

    jest.clearAllMocks();
    const error = await validar({
      correoCobranza: 'cobranza-aguacates',
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    const respuesta = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    expect(respuesta.message).toContain('El correo de cobranza no es válido.');
    expect(prisma.empresa.update).not.toHaveBeenCalled();
  });

  it('persiste nombre, banco y serie, y convierte el vacío en null', async () => {
    await aceptaYPersiste(
      {
        nombreCuentaBancaria: 'Aguacates de Puebla',
        banco: 'BBVA',
        serieFactura: 'CS-',
      },
      {
        nombreCuentaBancaria: 'Aguacates de Puebla',
        banco: 'BBVA',
        serieFactura: 'CS-',
      },
    );
    jest.clearAllMocks();
    prisma.empresa.update.mockResolvedValue({ codigoEmpresa: 'Y9IHZ' });
    await aceptaYPersiste(
      { nombreCuentaBancaria: '', banco: '   ', serieFactura: '' },
      { nombreCuentaBancaria: null, banco: null, serieFactura: null },
    );
  });
});
