const enableShutdownHooks = jest.fn();
const listen = jest.fn().mockResolvedValue(undefined);

const fakeApp = {
  enableShutdownHooks,
  get: jest.fn().mockReturnValue({
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3001'),
  }),
  use: jest.fn(),
  enableCors: jest.fn(),
  useGlobalPipes: jest.fn(),
  useGlobalFilters: jest.fn(),
  listen,
};

jest.mock('@nestjs/core', () => ({
  NestFactory: { create: jest.fn().mockResolvedValue(fakeApp) },
}));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('./core/security/validate-security-env', () => ({
  validateSecurityEnv: jest.fn(),
}));
jest.mock('./core/swagger/setup-swagger', () => ({ setupSwagger: jest.fn() }));

describe('bootstrap (main.ts)', () => {
  beforeAll(async () => {
    await import('./main');
    // bootstrap() no se exporta y corre con `void`: esperar a que termine.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('habilita los shutdown hooks para que ECS pueda cerrar la tarea con SIGTERM', () => {
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  });

  it('registra los shutdown hooks antes de empezar a escuchar', () => {
    expect(listen).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks.mock.invocationCallOrder[0]).toBeLessThan(
      listen.mock.invocationCallOrder[0],
    );
  });
});
