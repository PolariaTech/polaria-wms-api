import { ConversacionesRepository } from './conversaciones.repository';

describe('ConversacionesRepository.appendMensaje', () => {
  const owned = { idConversacion: 'f3000001-0001-4001-8001-000000000001' };
  const baseParams = {
    idConversacion: owned.idConversacion,
    idUsuario: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    rol: 'user' as const,
    tipo: 'text' as const,
    contenido: 'Hola soporte',
    esError: false,
    createdAt: new Date('2026-07-28T12:00:00.000Z'),
  };

  function buildRepo() {
    const prisma = {
      widgetConversacion: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      widgetMensaje: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const repo = new ConversacionesRepository(prisma);
    return { repo, prisma };
  }

  it('retorna null cuando la conversación no pertenece al usuario', async () => {
    const { repo, prisma } = buildRepo();
    prisma.widgetConversacion.findFirst.mockResolvedValue(null);

    const result = await repo.appendMensaje(baseParams);

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deduplica reintento al detectar unique violation (P2002)', async () => {
    const { repo, prisma } = buildRepo();
    prisma.widgetConversacion.findFirst.mockResolvedValue(owned);

    const duplicateError = Object.assign(new Error('duplicate'), {
      code: 'P2002',
    });
    prisma.$transaction.mockRejectedValue(duplicateError);

    const existing = {
      idMensaje: 'f3000001-0001-4001-8001-000000000099',
      rol: baseParams.rol,
      tipo: baseParams.tipo,
      contenido: baseParams.contenido,
      esError: baseParams.esError,
      createdAt: baseParams.createdAt,
    };
    prisma.widgetMensaje.findFirst.mockResolvedValue(existing);
    prisma.widgetConversacion.update.mockResolvedValue({ idConversacion: owned.idConversacion });

    const result = await repo.appendMensaje(baseParams);

    expect(prisma.widgetMensaje.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idConversacion: baseParams.idConversacion,
          rol: baseParams.rol,
          tipo: baseParams.tipo,
          contenido: baseParams.contenido,
          esError: baseParams.esError,
          createdAt: baseParams.createdAt,
        }),
      }),
    );
    // Se invoca una vez al construir la transacción y otra en el fallback dedupe.
    expect(prisma.widgetConversacion.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual(existing);
  });
});
