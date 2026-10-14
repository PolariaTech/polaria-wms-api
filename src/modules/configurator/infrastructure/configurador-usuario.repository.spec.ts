import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { ConfiguradorUsuarioRepository } from './configurador-usuario.repository';

describe('ConfiguradorUsuarioRepository.createUsuarioWithOptionalAsignacion', () => {
  const usuarioCreated = {
    idUsuario: 'usr-new',
    idAuth: 'auth-new',
    idRol: WmsRol.administrador_bodega,
    codigoEmpresa: '1XZ77',
    codigoCuenta: '1YW43',
    nombre: 'Demo Admin Bodega',
    username: 'J1YY5',
    correo: 'demo.admin.bodega@polaria.tech',
    telefono: null,
    idCreador: 'usr-creador',
    accesoWms: true,
    accesoMateo: true,
  };

  const prisma = {
    empresa: {
      findUnique: jest.fn(),
    },
    usuario: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  };

  const repository = new ConfiguradorUsuarioRepository(
    prisma as unknown as PrismaService,
  );

  const baseInput = {
    idAuth: 'auth-new',
    idRol: WmsRol.administrador_bodega,
    codigoEmpresa: '1XZ77',
    codigoCuenta: '1YW43',
    nombre: 'Demo Admin Bodega',
    username: 'J1YY5',
    correo: 'demo.admin.bodega@polaria.tech',
    telefono: null,
    idCreador: 'usr-creador',
    idBodega: 'd0911483-ecce-4864-9383-58b7a9b8171f',
    accesoWms: true,
    accesoMateo: true,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.usuario.create.mockResolvedValue(usuarioCreated);
    prisma.usuario.delete.mockResolvedValue(usuarioCreated);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
  });

  it('inserta asignacion_bodega en emp_* cuando la empresa tiene schema_name', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      schemaName: 'emp_demo_1xz77',
    });

    const created =
      await repository.createUsuarioWithOptionalAsignacion(baseInput);

    expect(created.idUsuario).toBe('usr-new');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO emp_demo_1xz77.asignacion_bodega'),
      'usr-new',
      'd0911483-ecce-4864-9383-58b7a9b8171f',
      WmsRol.administrador_bodega,
    );
    expect(prisma.usuario.delete).not.toHaveBeenCalled();
  });

  it('inserta asignacion_bodega en public cuando schema_name es null (Tecno)', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      schemaName: null,
    });

    await repository.createUsuarioWithOptionalAsignacion({
      ...baseInput,
      codigoEmpresa: 'EVU53',
      codigoCuenta: 'TECN1',
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.asignacion_bodega'),
      'usr-new',
      'd0911483-ecce-4864-9383-58b7a9b8171f',
      WmsRol.administrador_bodega,
    );
  });

  it('no inserta asignacion si no hay idBodega', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      schemaName: 'emp_demo_1xz77',
    });

    await repository.createUsuarioWithOptionalAsignacion({
      ...baseInput,
      idBodega: undefined,
      idRol: WmsRol.operador_cuenta,
    });

    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('borra el usuario public si falla el INSERT de asignacion', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      schemaName: 'emp_demo_1xz77',
    });
    prisma.$executeRawUnsafe.mockRejectedValue(
      new Error(
        'insert or update on table "asignacion_bodega" violates foreign key constraint "fk_asignacion_bodega" Key (id_bodega)=(...) is not present in table "bodega" 23503',
      ),
    );

    await expect(
      repository.createUsuarioWithOptionalAsignacion(baseInput),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.usuario.delete).toHaveBeenCalledWith({
      where: { idUsuario: 'usr-new' },
    });
  });

  it('mapea FK genérica a BadRequestException', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      schemaName: 'emp_demo_1xz77',
    });
    prisma.$executeRawUnsafe.mockRejectedValue(
      new Error('foreign key constraint "fk_asignacion_usuario" 23503'),
    );

    await expect(
      repository.createUsuarioWithOptionalAsignacion(baseInput),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
