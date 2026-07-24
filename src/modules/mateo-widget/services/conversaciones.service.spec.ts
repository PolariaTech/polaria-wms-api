import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { ConversacionesRepository } from '../infrastructure/conversaciones.repository';
import { ConversacionesService } from './conversaciones.service';

describe('ConversacionesService', () => {
  let service: ConversacionesService;
  let repository: jest.Mocked<ConversacionesRepository>;

  const ctx = {
    idUsuario: 'usr-1',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    codigosCuentaEmpresa: ['CTA001'],
    idBodegas: [] as string[],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversacionesService,
        {
          provide: ConversacionesRepository,
          useValue: {
            listByUsuario: jest.fn(),
            findByIdForUsuario: jest.fn(),
            create: jest.fn(),
            appendMensaje: jest.fn(),
            deleteForUsuario: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ConversacionesService);
    repository = module.get(ConversacionesRepository);
  });

  it('lista conversaciones del usuario', async () => {
    repository.listByUsuario.mockResolvedValue([
      {
        idConversacion: 'conv-1',
        titulo: 'Hola',
        codigoCuenta: 'CTA001',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    await expect(service.list(ctx)).resolves.toEqual([
      {
        idConversacion: 'conv-1',
        titulo: 'Hola',
        codigoCuenta: 'CTA001',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('lanza 404 si la conversación no pertenece al usuario', async () => {
    repository.findByIdForUsuario.mockResolvedValue(null);

    await expect(service.getDetalle('conv-x', ctx)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('crea conversación vacía con codigoCuenta del tenant', async () => {
    repository.create.mockResolvedValue({
      idConversacion: 'conv-2',
      titulo: null,
      codigoCuenta: 'CTA001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.create({}, ctx);

    expect(repository.create).toHaveBeenCalledWith({
      idUsuario: 'usr-1',
      codigoCuenta: 'CTA001',
      titulo: undefined,
    });
    expect(result.mensajes).toEqual([]);
  });

  it('appendMensaje valida ownership', async () => {
    repository.appendMensaje.mockResolvedValue(null);

    await expect(
      service.appendMensaje('conv-x', { rol: 'user', contenido: 'hola' }, ctx),
    ).rejects.toThrow(NotFoundException);
  });
});
