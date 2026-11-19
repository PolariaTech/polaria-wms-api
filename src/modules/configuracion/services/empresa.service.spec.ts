import { BadRequestException, ConflictException } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { EmpresaRepository } from '../infrastructure/empresa.repository';
import { subirLogoEmpresa } from '../infrastructure/empresa-logo';

jest.mock('../infrastructure/empresa-logo', () => ({
  subirLogoEmpresa: jest.fn(),
}));

const subir = subirLogoEmpresa as jest.MockedFunction<typeof subirLogoEmpresa>;

describe('EmpresaService.create', () => {
  const repository = {
    findByCodigo: jest.fn(),
    create: jest.fn(),
  };

  const service = new EmpresaService(
    repository as unknown as EmpresaRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provisiona empresa nueva con schemaName', async () => {
    repository.findByCodigo.mockResolvedValue(null);
    repository.create.mockResolvedValue({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
      telefono: null,
      estaActiva: true,
      schemaName: 'emp_andino',
    });

    const result = await service.create({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
    });

    expect(repository.create).toHaveBeenCalledWith({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
      telefono: null,
      idCreador: null,
    });
    expect(result.schemaName).toBe('emp_andino');
  });

  it('rechaza código duplicado', async () => {
    repository.findByCodigo.mockResolvedValue({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Existente',
      telefono: null,
      estaActiva: true,
    });

    await expect(
      service.create({
        codigoEmpresa: 'ANDINO',
        razonSocial: 'Otra',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('EmpresaService.update ficha fiscal', () => {
  const existente = {
    codigoEmpresa: 'Y9IHZ',
    razonSocial: 'Aguacates de puebla',
    telefono: null,
    estaActiva: true,
    schemaName: 'emp_jbr_cygnus_y9ihz',
    rfc: null,
    regimenFiscal: null,
    codigoPostalExpedicion: null,
    nombreCuentaBancaria: null,
    banco: null,
    clabe: null,
    correoCobranza: null,
    serieFactura: null,
    logoPath: 'Y9IHZ/logo.jpg',
  };

  const repository = {
    findByCodigo: jest.fn(),
    update: jest.fn(),
  };

  const service = new EmpresaService(repository as unknown as EmpresaRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findByCodigo.mockResolvedValue(existente);
    repository.update.mockImplementation((_codigo, data) =>
      Promise.resolve({ ...existente, ...data }),
    );
  });

  it('conserva el logo si el PATCH no trae archivo', async () => {
    await service.update('Y9IHZ', { banco: 'BBVA' });

    expect(subir).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith('Y9IHZ', { banco: 'BBVA' });
  });

  it('guarda los 8 datos fiscales y el JPEG', async () => {
    subir.mockResolvedValue({ ok: true, logoPath: 'Y9IHZ/logo.jpg' });
    const ficha = {
      rfc: 'APU210325668',
      regimenFiscal: '601',
      codigoPostalExpedicion: '77560',
      nombreCuentaBancaria: 'Aguacates de Puebla',
      banco: 'BBVA',
      clabe: '012528001186364430',
      correoCobranza: 'cobranza@aguacatesdepuebla.com',
      serieFactura: 'CS-',
    };

    const guardada = await service.update('Y9IHZ', ficha, {
      buffer: Buffer.from('jpeg'),
      mimetype: 'image/jpeg',
      size: 4,
    });

    expect(repository.update).toHaveBeenCalledWith('Y9IHZ', {
      ...ficha,
      logoPath: 'Y9IHZ/logo.jpg',
    });
    expect(guardada.logoPath).toBe('Y9IHZ/logo.jpg');
    expect(guardada.rfc).toBe('APU210325668');
  });

  it('guarda el logo y no borra la ficha si el archivo es válido', async () => {
    subir.mockResolvedValue({ ok: true, logoPath: 'Y9IHZ/logo.png' });

    await service.update(
      'Y9IHZ',
      {},
      {
        buffer: Buffer.from('png'),
        mimetype: 'image/png',
        size: 3,
      },
    );

    expect(repository.update).toHaveBeenCalledWith('Y9IHZ', {
      logoPath: 'Y9IHZ/logo.png',
    });
  });

  it('no escribe la fila si el logo es demasiado grande', async () => {
    subir.mockResolvedValue({ ok: false, message: 'El logo supera 1 MB.' });

    await expect(
      service.update(
        'Y9IHZ',
        { banco: 'BBVA' },
        {
          buffer: Buffer.alloc(1),
          mimetype: 'image/jpeg',
          size: 1_048_577,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.update).not.toHaveBeenCalled();
  });
});
