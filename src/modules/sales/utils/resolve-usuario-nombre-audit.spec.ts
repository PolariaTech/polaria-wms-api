import {
  mensajePedidoConfirmadoBitacora,
  resolveUsuarioNombreAudit,
} from './resolve-usuario-nombre-audit';

describe('resolveUsuarioNombreAudit', () => {
  it('devuelve null sin idUsuario', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn() },
    };
    await expect(
      resolveUsuarioNombreAudit(prisma as never, null),
    ).resolves.toBeNull();
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('devuelve el nombre del usuario', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ nombre: '  Andrés  ' }),
      },
    };
    await expect(
      resolveUsuarioNombreAudit(prisma as never, 'user-1'),
    ).resolves.toBe('Andrés');
  });

  it('devuelve null si la lectura falla', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockRejectedValue(new Error('db')),
      },
    };
    await expect(
      resolveUsuarioNombreAudit(prisma as never, 'user-1'),
    ).resolves.toBeNull();
  });
});

describe('mensajePedidoConfirmadoBitacora', () => {
  it('incluye el autor cuando existe', () => {
    expect(mensajePedidoConfirmadoBitacora('Luis')).toBe(
      'Pedido confirmado y enviado a bodega por Luis.',
    );
  });

  it('usa mensaje genérico sin autor', () => {
    expect(mensajePedidoConfirmadoBitacora(null)).toBe(
      'Pedido enviado a bodega (emitido).',
    );
  });
});
