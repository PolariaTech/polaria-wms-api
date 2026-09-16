import {
  ConversacionesRepository,
  shouldUpdateTitulo,
  tituloFromUserMensaje,
  WIDGET_TITULO_IMAGEN,
} from './conversaciones.repository';

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
      forSchema: jest.fn(),
    } as any;
    prisma.forSchema.mockReturnValue(prisma);

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
    prisma.widgetConversacion.findFirst.mockResolvedValue({
      ...owned,
      titulo: null,
    });

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
    prisma.widgetConversacion.update.mockResolvedValue({
      idConversacion: owned.idConversacion,
    });

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
    expect(prisma.widgetConversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titulo: 'Hola soporte',
        }),
      }),
    );
    expect(result).toEqual(existing);
  });

  it('fija el título con el primer mensaje de texto del usuario', async () => {
    const { repo, prisma } = buildRepo();
    prisma.widgetConversacion.findFirst.mockResolvedValue({
      ...owned,
      titulo: null,
    });

    const createdMsg = {
      idMensaje: 'f3000001-0001-4001-8001-000000000010',
      rol: 'user',
      tipo: 'text',
      contenido: 'Prueba continuidad 1',
      esError: false,
      createdAt: baseParams.createdAt,
    };
    prisma.$transaction.mockResolvedValue([createdMsg, {}]);

    const result = await repo.appendMensaje({
      ...baseParams,
      contenido: 'Prueba continuidad 1',
    });

    expect(result).toEqual(createdMsg);
    expect(prisma.widgetConversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idConversacion: owned.idConversacion },
        data: expect.objectContaining({
          titulo: 'Prueba continuidad 1',
        }),
      }),
    );
  });

  it('no sobrescribe un título ya existente (salvo placeholder Imagen)', async () => {
    const { repo, prisma } = buildRepo();
    prisma.widgetConversacion.findFirst.mockResolvedValue({
      ...owned,
      titulo: 'Titulo previo',
    });
    prisma.$transaction.mockResolvedValue([
      {
        idMensaje: 'f3000001-0001-4001-8001-000000000011',
        ...baseParams,
        contenido: 'otro mensaje',
      },
      {},
    ]);

    await repo.appendMensaje({ ...baseParams, contenido: 'otro mensaje' });

    expect(prisma.widgetConversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { updatedAt: expect.any(Date) },
      }),
    );
  });
});

describe('tituloFromUserMensaje / shouldUpdateTitulo', () => {
  it('deriva título de texto truncado e imagen', () => {
    expect(tituloFromUserMensaje('text', '  hola mundo  ')).toBe('hola mundo');
    expect(tituloFromUserMensaje('image', 'https://cdn.example/a.png')).toBe(
      WIDGET_TITULO_IMAGEN,
    );
    expect(tituloFromUserMensaje('text', '   ')).toBeNull();
  });

  it('permite upgrade desde placeholder Imagen con caption de texto', () => {
    expect(shouldUpdateTitulo(null, 'user', 'text', false)).toBe(true);
    expect(shouldUpdateTitulo('Titulo', 'user', 'text', false)).toBe(false);
    expect(
      shouldUpdateTitulo(WIDGET_TITULO_IMAGEN, 'user', 'text', false),
    ).toBe(true);
    expect(shouldUpdateTitulo(null, 'ai', 'text', false)).toBe(false);
    expect(shouldUpdateTitulo(null, 'user', 'text', true)).toBe(false);
  });
});
